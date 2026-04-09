# Claude Stream Deck — Design Spec

## Overview

Integrate Claude Code session state with the Elgato Stream Deck (integrated in Corsair Galleon 100 SD keyboard) to provide real-time visual monitoring of 4-5 concurrent Claude sessions and one-tap tab switching in iTerm2.

## Problem

The user runs 4-5 Claude Code sessions in iTerm2 tabs. Current hooks change tab colors and titles, but these are only visible when iTerm2 is in the foreground and the tabs are small. The Stream Deck's 12 LCD buttons provide an always-visible dashboard.

## Architecture

```
Hooks Claude       curl POST        Serveur HTTP        WebSocket         Plugin Stream Deck
(settings.json) ──────────────> (Node.js :7842) ──────────────────> (SDK Elgato v2)
                  fire-and-forget   State in memory       Push updates      12 boutons LCD
                                    SVG rendering                           Au clic: AppleScript
                                    WS server                               → iTerm2 tab switch
```

Three components:

1. **Claude hooks** — enriched with a background `curl` per state change
2. **Local HTTP server** — receives state, renders buttons, pushes to plugin
3. **Stream Deck plugin** — displays buttons, handles clicks

## Component 1: Claude Hooks

Each existing hook gets an additional `curl` call, fire-and-forget (backgrounded with `&`, `--max-time 1`).

### Payload

```json
{
  "session": "project-name",
  "state": "thinking",
  "color": { "r": 30, "g": 100, "b": 255 },
  "detail": "Reading: file.ts"
}
```

### State mapping

| Hook Event        | state        | color RGB       |
|-------------------|-------------|-----------------|
| SessionStart      | idle        | (0, 200, 0)    |
| UserPromptSubmit  | thinking    | (30, 100, 255) |
| PreToolUse        | tool_use    | (30, 100, 255) |
| PostToolUse       | thinking    | (30, 100, 255) |
| PostToolUseFailure| error       | (255, 0, 0)    |
| PermissionRequest | permission  | (255, 165, 0)  |
| Stop              | done        | (0, 200, 0)    |
| StopFailure       | error       | (255, 0, 0)    |

### Hook format

```bash
# Added at the end of each hook command, after existing iTerm2 escape sequences
curl -s --max-time 1 -X POST http://localhost:7842/state \
  -H 'Content-Type: application/json' \
  -d '{"session":"'"$(basename "$PWD")"'","state":"STATE","color":{"r":R,"g":G,"b":B},"detail":"DETAIL"}' &
```

Existing iTerm2 escape sequences are preserved — the curl is additive only.

## Component 2: Local HTTP Server (Node.js)

### Endpoints

- `POST /state` — receive session state update from hooks
- `GET /health` — health check
- WebSocket upgrade on `/streamdeck` — push updates to the Stream Deck plugin

### Session Management

- `sessions: Map<string, SessionState>` — max 12 entries (one per button)
- Each new session name gets the next free button index (0-11)
- Assignment persists while the server runs
- On server restart, assignments are rebuilt as sessions report in

### SessionState

```typescript
interface SessionState {
  session: string;       // project name (basename of PWD)
  state: string;         // idle | thinking | tool_use | permission | error | done
  color: { r: number; g: number; b: number };
  detail?: string;       // optional action detail
  buttonIndex: number;   // 0-11
  lastUpdate: number;    // timestamp
}
```

### Button Rendering

SVG generated server-side per button:
- Background: session color (full rectangle)
- Top text: project name (truncated to ~10 chars)
- Bottom text: state or detail
- Rendered as SVG string, sent as base64 data URI to the plugin

No external image library needed — the Stream Deck SDK accepts SVG data URIs.

### Server config

- Port: 7842
- No external dependencies beyond Node.js built-ins (`http`, `crypto`, `url`)
- `ws` npm package for WebSocket support (lightweight)

## Component 3: Stream Deck Plugin

### SDK

Elgato Stream Deck SDK v2 (WebSocket-based). The plugin is a folder named `com.claude.streamdeck.sdPlugin/`.

### Structure

```
com.claude.streamdeck.sdPlugin/
├── manifest.json           # Plugin declaration, actions, icon
├── plugin.js               # Main logic
├── property-inspector/
│   └── pi.html             # Empty for now
└── images/
    ├── icon.png            # Plugin icon (144x144)
    └── action-icon.png     # Action icon (72x72)
```

### manifest.json

- UUID: `com.claude.streamdeck`
- One action: `com.claude.streamdeck.session`
- Category: "Claude Code"
- OS: macOS only
- Software minimum version: 6.0

### Plugin logic (plugin.js)

1. On load: connect to local server via WebSocket (`ws://localhost:7842/streamdeck`)
2. On receiving state update from server: call `setImage` (SVG data URI) and `setTitle` on the corresponding button context
3. On `keyDown` event from SDK: execute AppleScript to switch iTerm2 tab

### AppleScript for tab switching

```applescript
tell application "iTerm2"
    activate
    tell current window
        select tab {tabIndex}
    end tell
end tell
```

Executed via `execFile('osascript', ['-e', script])` to avoid shell injection.

### Button-to-context mapping

The plugin maintains a map of `buttonIndex → Stream Deck context`. When the server assigns a session to button N, the plugin maps it to whichever physical button is in position N. The tab index sent in the `keyDown` handler is `buttonIndex + 1` (1-based for iTerm2).

## Installation

### install.sh

1. `npm install` in `server/`
2. Symlink or copy `com.claude.streamdeck.sdPlugin/` to `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`
3. Install launchd plist to `~/Library/LaunchAgents/`
4. `launchctl load` the plist
5. Restart Stream Deck app

### launchd plist (com.claude.streamdeck.plist)

```xml
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude.streamdeck.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/claude-stream-deck/server/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/claude-streamdeck.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/claude-streamdeck.err</string>
</dict>
</plist>
```

## Project Structure

```
claude-stream-deck/
├── server/
│   ├── index.js
│   ├── session-manager.js
│   ├── button-renderer.js
│   └── package.json
├── plugin/
│   └── com.claude.streamdeck.sdPlugin/
│       ├── manifest.json
│       ├── plugin.js
│       ├── property-inspector/
│       │   └── pi.html
│       └── images/
│           ├── icon.png
│           └── action-icon.png
├── install/
│   ├── com.claude.streamdeck.plist
│   └── install.sh
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-09-claude-stream-deck-design.md
└── README.md
```

## What's Out of Scope (for now)

- Interactive actions beyond tab switching (approving permissions, sending input)
- Configurable button layout via property inspector
- Multi-window iTerm2 support (single window, multiple tabs only)
- Auto-detection of tab order changes
- Persistence of session-to-button mapping across server restarts
