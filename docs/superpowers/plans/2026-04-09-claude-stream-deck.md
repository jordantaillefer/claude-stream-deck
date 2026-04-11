# Claude Stream Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real-time Claude Code session monitoring on Elgato Stream Deck with one-tap iTerm2 tab switching.

**Architecture:** A local Node.js HTTP+WebSocket server receives state updates from Claude Code hooks via `curl`, renders SVG button images, and pushes them to a Stream Deck plugin. The plugin displays the images and executes AppleScript on button press to switch iTerm2 tabs.

**Tech Stack:** Node.js 24, `ws` npm package, Elgato Stream Deck SDK v2 (`@elgato/streamdeck`), AppleScript via `osascript`.

---

## File Structure

```
claude-stream-deck/
├── server/
│   ├── package.json              # Server dependencies (ws)
│   ├── index.js                  # HTTP server + WebSocket server entry point
│   ├── session-manager.js        # Session state storage + button index assignment
│   └── button-renderer.js        # SVG generation for button images
├── plugin/
│   └── com.claude.streamdeck.sdPlugin/
│       ├── manifest.json         # Stream Deck plugin manifest
│       ├── bin/
│       │   └── plugin.js         # Plugin entry point (connects to SDK + local server)
│       ├── property-inspector/
│       │   └── pi.html           # Minimal property inspector
│       └── images/
│           ├── plugin-icon.png   # Plugin icon 144x144
│           └── action-icon.png   # Action icon 72x72
├── install/
│   ├── com.claude.streamdeck.plist  # launchd plist for server auto-start
│   └── install.sh                    # Installation script
└── server/
    └── test/
        ├── session-manager.test.js  # Tests for session manager
        ├── button-renderer.test.js  # Tests for SVG rendering
        └── server.test.js           # Integration tests for HTTP+WS
```

---

### Task 1: Server — Session Manager

**Files:**
- Create: `server/session-manager.js`
- Create: `server/test/session-manager.test.js`

- [ ] **Step 1: Write the failing test for session creation**

```javascript
// server/test/session-manager.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../session-manager.js';

describe('SessionManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('assigns button index 0 to first session', () => {
    const session = manager.update({
      session: 'project-a',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.equal(session.buttonIndex, 0);
  });

  it('assigns incrementing button indices', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    const session = manager.update({ session: 'project-b', state: 'thinking', color: { r: 30, g: 100, b: 255 } });
    assert.equal(session.buttonIndex, 1);
  });

  it('reuses same button index for same session', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    const session = manager.update({ session: 'project-a', state: 'thinking', color: { r: 30, g: 100, b: 255 } });
    assert.equal(session.buttonIndex, 0);
    assert.equal(session.state, 'thinking');
  });

  it('caps at 12 sessions', () => {
    for (let i = 0; i < 12; i++) {
      manager.update({ session: `project-${i}`, state: 'idle', color: { r: 0, g: 200, b: 0 } });
    }
    const session = manager.update({ session: 'project-overflow', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    assert.equal(session, null);
  });

  it('returns all sessions', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    manager.update({ session: 'project-b', state: 'thinking', color: { r: 30, g: 100, b: 255 } });
    const all = manager.getAll();
    assert.equal(all.length, 2);
  });

  it('returns session by button index', () => {
    manager.update({ session: 'project-a', state: 'idle', color: { r: 0, g: 200, b: 0 } });
    const session = manager.getByButtonIndex(0);
    assert.equal(session.session, 'project-a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd <repo> && node --test server/test/session-manager.test.js`
Expected: FAIL — `Cannot find module '../session-manager.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// server/session-manager.js
const MAX_BUTTONS = 12;

export class SessionManager {
  constructor() {
    this.sessions = new Map();  // session name → SessionState
    this.nextIndex = 0;
  }

  update({ session, state, color, detail }) {
    const existing = this.sessions.get(session);

    if (existing) {
      existing.state = state;
      existing.color = color;
      existing.detail = detail;
      existing.lastUpdate = Date.now();
      return { ...existing };
    }

    if (this.nextIndex >= MAX_BUTTONS) {
      return null;
    }

    const newSession = {
      session,
      state,
      color,
      detail,
      buttonIndex: this.nextIndex,
      lastUpdate: Date.now(),
    };

    this.sessions.set(session, newSession);
    this.nextIndex++;
    return { ...newSession };
  }

  getAll() {
    return [...this.sessions.values()];
  }

  getByButtonIndex(index) {
    for (const session of this.sessions.values()) {
      if (session.buttonIndex === index) return { ...session };
    }
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd <repo> && node --test server/test/session-manager.test.js`
Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/session-manager.js server/test/session-manager.test.js
git commit -m "feat: add session manager with button index assignment"
```

---

### Task 2: Server — Button Renderer (SVG)

**Files:**
- Create: `server/button-renderer.js`
- Create: `server/test/button-renderer.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// server/test/button-renderer.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderButton, renderEmptyButton } from '../button-renderer.js';

describe('renderButton', () => {
  it('returns an SVG string', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('</svg>'));
  });

  it('includes session name in SVG', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.includes('my-project'));
  });

  it('includes background color', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.ok(svg.includes('rgb(30,100,255)'));
  });

  it('includes state text', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'permission',
      color: { r: 255, g: 165, b: 0 },
    });
    assert.ok(svg.includes('permission'));
  });

  it('truncates long session names', () => {
    const svg = renderButton({
      session: 'very-long-project-name-here',
      state: 'idle',
      color: { r: 0, g: 200, b: 0 },
    });
    assert.ok(svg.includes('very-long-…'));
  });

  it('shows detail instead of state when provided', () => {
    const svg = renderButton({
      session: 'my-project',
      state: 'tool_use',
      color: { r: 30, g: 100, b: 255 },
      detail: 'Reading: app.ts',
    });
    assert.ok(svg.includes('Reading:'));
  });
});

describe('renderEmptyButton', () => {
  it('returns a dark SVG', () => {
    const svg = renderEmptyButton();
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('rgb(30,30,30)'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd <repo> && node --test server/test/button-renderer.test.js`
Expected: FAIL — `Cannot find module '../button-renderer.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// server/button-renderer.js
const SIZE = 144;
const MAX_NAME_LEN = 10;

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderButton({ session, state, color, detail }) {
  const { r, g, b } = color;
  const name = escapeXml(truncate(session, MAX_NAME_LEN));
  const bottomText = escapeXml(truncate(detail || state, 14));

  // Use white text on dark backgrounds, black on light
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  const textColor = luminance > 140 ? '#000' : '#fff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="12" fill="rgb(${r},${g},${b})" />
  <text x="${SIZE / 2}" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="${textColor}">${name}</text>
  <text x="${SIZE / 2}" y="100" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="${textColor}" opacity="0.85">${bottomText}</text>
</svg>`;
}

export function renderEmptyButton() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="12" fill="rgb(30,30,30)" />
</svg>`;
}

export function svgToDataUri(svg) {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd <repo> && node --test server/test/button-renderer.test.js`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/button-renderer.js server/test/button-renderer.test.js
git commit -m "feat: add SVG button renderer for Stream Deck"
```

---

### Task 3: Server — HTTP + WebSocket Server

**Files:**
- Create: `server/package.json`
- Create: `server/index.js`
- Create: `server/test/server.test.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "claude-stream-deck-server",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node index.js",
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2: Run npm install**

Run: `cd <repo>/server && npm install`
Expected: `ws` installed, `node_modules` created, `package-lock.json` generated.

- [ ] **Step 3: Create .gitignore**

```gitignore
node_modules/
```

Write to: `server/.gitignore`

- [ ] **Step 4: Write the failing integration test**

```javascript
// server/test/server.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createServer } from '../index.js';

function httpPost(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    }).on('error', reject);
  });
}

describe('Server', () => {
  let server;
  let port;

  before(async () => {
    const result = createServer(0); // port 0 = random free port
    server = result.server;
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('responds to GET /health', async () => {
    const res = await httpGet(port, '/health');
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('ok'));
  });

  it('accepts POST /state and returns 200', async () => {
    const res = await httpPost(port, '/state', {
      session: 'test-project',
      state: 'thinking',
      color: { r: 30, g: 100, b: 255 },
    });
    assert.equal(res.status, 200);
  });

  it('rejects POST /state with missing fields', async () => {
    const res = await httpPost(port, '/state', { session: 'test' });
    assert.equal(res.status, 400);
  });

  it('pushes state updates to WebSocket clients on /streamdeck', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/streamdeck`);
    const message = await new Promise((resolve) => {
      ws.on('open', async () => {
        await httpPost(port, '/state', {
          session: 'ws-test',
          state: 'permission',
          color: { r: 255, g: 165, b: 0 },
        });
      });
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
        ws.close();
      });
    });

    assert.equal(message.type, 'state_update');
    assert.equal(message.session.session, 'ws-test');
    assert.ok(message.image.startsWith('data:image/svg+xml;base64,'));
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd <repo>/server && node --test test/server.test.js`
Expected: FAIL — `Cannot find module '../index.js'` or `createServer is not a function`

- [ ] **Step 6: Write the server implementation**

```javascript
// server/index.js
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { SessionManager } from './session-manager.js';
import { renderButton, renderEmptyButton, svgToDataUri } from './button-renderer.js';

const DEFAULT_PORT = 7842;

export function createServer(port = DEFAULT_PORT) {
  const sessionManager = new SessionManager();
  const wsClients = new Set();

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', sessions: sessionManager.getAll().length }));
      return;
    }

    if (req.method === 'POST' && req.url === '/state') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.session || !data.state || !data.color) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields: session, state, color' }));
            return;
          }

          const session = sessionManager.update(data);
          if (!session) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Max sessions reached (12)' }));
            return;
          }

          const svg = renderButton(session);
          const image = svgToDataUri(svg);

          const message = JSON.stringify({
            type: 'state_update',
            session,
            image,
          });

          for (const client of wsClients) {
            if (client.readyState === 1) {
              client.send(message);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, buttonIndex: session.buttonIndex }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  const wss = new WebSocketServer({ server, path: '/streamdeck' });

  wss.on('connection', (ws) => {
    wsClients.add(ws);

    // Send current state of all sessions on connect
    for (const session of sessionManager.getAll()) {
      const svg = renderButton(session);
      const image = svgToDataUri(svg);
      ws.send(JSON.stringify({ type: 'state_update', session, image }));
    }

    ws.on('close', () => wsClients.delete(ws));
  });

  return { server, sessionManager, wsClients };
}

// Start server when run directly
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  const { server } = createServer();
  server.listen(DEFAULT_PORT, '127.0.0.1', () => {
    console.log(`Claude Stream Deck server listening on http://127.0.0.1:${DEFAULT_PORT}`);
  });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd <repo>/server && node --test test/server.test.js`
Expected: All 4 tests pass.

- [ ] **Step 8: Run all server tests together**

Run: `cd <repo>/server && npm test`
Expected: All tests pass (session-manager + button-renderer + server).

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/package-lock.json server/.gitignore server/index.js server/test/server.test.js
git commit -m "feat: add HTTP + WebSocket server for state updates"
```

---

### Task 4: Stream Deck Plugin

**Files:**
- Create: `plugin/com.claude.streamdeck.sdPlugin/manifest.json`
- Create: `plugin/com.claude.streamdeck.sdPlugin/bin/plugin.js`
- Create: `plugin/com.claude.streamdeck.sdPlugin/property-inspector/pi.html`
- Create: `plugin/com.claude.streamdeck.sdPlugin/images/plugin-icon.png` (placeholder)
- Create: `plugin/com.claude.streamdeck.sdPlugin/images/action-icon.png` (placeholder)

- [ ] **Step 1: Create manifest.json**

```json
{
  "$schema": "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
  "UUID": "com.claude.streamdeck",
  "Version": "1.0.0.0",
  "Name": "Claude Code Monitor",
  "Description": "Real-time monitoring of Claude Code sessions with one-tap iTerm2 tab switching",
  "Author": "Jordan Taillefer",
  "Icon": "images/plugin-icon",
  "CategoryIcon": "images/plugin-icon",
  "Category": "Claude Code",
  "CodePath": "bin/plugin.js",
  "SDKVersion": 2,
  "Software": {
    "MinimumVersion": "6.6"
  },
  "Nodejs": {
    "Version": "20",
    "Debug": "enabled"
  },
  "OS": [
    {
      "Platform": "mac",
      "MinimumVersion": "13"
    }
  ],
  "Actions": [
    {
      "UUID": "com.claude.streamdeck.session",
      "Name": "Claude Session",
      "Icon": "images/action-icon",
      "PropertyInspectorPath": "property-inspector/pi.html",
      "Controllers": ["Keypad"],
      "States": [
        {
          "Image": "images/action-icon",
          "Title": "Claude",
          "ShowTitle": true,
          "TitleAlignment": "bottom",
          "TitleColor": "#FFFFFF"
        }
      ],
      "VisibleInActionsList": true
    }
  ]
}
```

- [ ] **Step 2: Create placeholder icons**

Generate minimal 144x144 and 72x72 PNG icons using Node.js. These are simple colored squares — functional placeholders.

```bash
cd <repo>
node -e "
const { writeFileSync } = require('fs');
const { mkdirSync } = require('fs');

// Minimal 1x1 PNG (will be scaled by Stream Deck)
// This is a valid minimal PNG file - a purple pixel
const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
mkdirSync('plugin/com.claude.streamdeck.sdPlugin/images', { recursive: true });
writeFileSync('plugin/com.claude.streamdeck.sdPlugin/images/plugin-icon.png', png1);
writeFileSync('plugin/com.claude.streamdeck.sdPlugin/images/action-icon.png', png1);
console.log('Icons created');
"
```

- [ ] **Step 3: Create property inspector (minimal)**

```html
<!-- plugin/com.claude.streamdeck.sdPlugin/property-inspector/pi.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Claude Session</title>
</head>
<body>
  <p>Claude Code session monitor. Buttons are assigned automatically.</p>
</body>
</html>
```

- [ ] **Step 4: Write the plugin entry point**

```javascript
// plugin/com.claude.streamdeck.sdPlugin/bin/plugin.js

// Stream Deck SDK v2 — raw WebSocket protocol
// The plugin receives CLI args: -port, -pluginUUID, -registerEvent, -info

import { WebSocket } from 'ws';
import { execFile } from 'node:child_process';

const SERVER_URL = 'ws://127.0.0.1:7842/streamdeck';
const RECONNECT_INTERVAL = 5000;

// Parse Stream Deck CLI arguments
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-port') args.port = argv[++i];
    else if (argv[i] === '-pluginUUID') args.uuid = argv[++i];
    else if (argv[i] === '-registerEvent') args.registerEvent = argv[++i];
    else if (argv[i] === '-info') args.info = JSON.parse(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv);

// --- Stream Deck WebSocket Connection ---

let sdSocket = null;
// Map: buttonIndex → Stream Deck context string
const buttonContexts = new Map();
// Map: context → buttonIndex
const contextButtons = new Map();
// Map: buttonIndex → session data (for click handling)
const buttonSessions = new Map();

function connectToStreamDeck() {
  sdSocket = new WebSocket(`ws://127.0.0.1:${args.port}`);

  sdSocket.on('open', () => {
    // Register with Stream Deck
    sdSocket.send(JSON.stringify({
      event: args.registerEvent,
      uuid: args.uuid,
    }));
  });

  sdSocket.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.event === 'willAppear') {
      // A button has appeared — track its context and position
      const { column, row } = msg.payload.coordinates;
      // Stream Deck buttons are indexed left-to-right, top-to-bottom
      // For a 4x3 grid: index = row * 4 + column (adjust cols per device)
      // We use the coordinates to derive a stable index
      const buttonIndex = row * 6 + column; // 6 columns for Galleon SD area
      buttonContexts.set(buttonIndex, msg.context);
      contextButtons.set(msg.context, buttonIndex);

      // If we have session data for this button, update its image
      const session = buttonSessions.get(buttonIndex);
      if (session) {
        sendImage(msg.context, session.image);
      }
    }

    if (msg.event === 'willDisappear') {
      const buttonIndex = contextButtons.get(msg.context);
      if (buttonIndex !== undefined) {
        buttonContexts.delete(buttonIndex);
        contextButtons.delete(msg.context);
      }
    }

    if (msg.event === 'keyDown') {
      const buttonIndex = contextButtons.get(msg.context);
      if (buttonIndex !== undefined) {
        const session = buttonSessions.get(buttonIndex);
        if (session) {
          switchToTab(session.session.buttonIndex + 1);
        }
      }
    }
  });

  sdSocket.on('close', () => {
    setTimeout(connectToStreamDeck, RECONNECT_INTERVAL);
  });

  sdSocket.on('error', () => {});
}

function sendImage(context, imageDataUri) {
  if (sdSocket && sdSocket.readyState === WebSocket.OPEN) {
    sdSocket.send(JSON.stringify({
      event: 'setImage',
      context,
      payload: { image: imageDataUri, target: 0 },
    }));
  }
}

function switchToTab(tabIndex) {
  const script = `
    tell application "iTerm2"
      activate
      tell current window
        select tab ${tabIndex}
      end tell
    end tell
  `;
  execFile('osascript', ['-e', script], (err) => {
    if (err) console.error('AppleScript error:', err.message);
  });
}

// --- Local Server WebSocket Connection ---

let serverSocket = null;

function connectToServer() {
  serverSocket = new WebSocket(SERVER_URL);

  serverSocket.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.type === 'state_update') {
      const { session, image } = msg;
      const buttonIndex = session.buttonIndex;

      buttonSessions.set(buttonIndex, { session, image });

      // Update the Stream Deck button if we have its context
      const context = buttonContexts.get(buttonIndex);
      if (context) {
        sendImage(context, image);
      }
    }
  });

  serverSocket.on('close', () => {
    setTimeout(connectToServer, RECONNECT_INTERVAL);
  });

  serverSocket.on('error', () => {});
}

// --- Start ---

connectToStreamDeck();
connectToServer();
```

**Note:** The column count for button index calculation (row * 6 + column) may need adjustment based on the actual Galleon 100 SD Stream Deck grid layout. The Galleon has a 4x3 (12 buttons) area — if it's 4 columns x 3 rows, change to `row * 4 + column`. This can be verified during manual testing.

- [ ] **Step 5: Commit**

```bash
git add plugin/
git commit -m "feat: add Stream Deck plugin with session monitoring and tab switching"
```

---

### Task 5: Installation Scripts

**Files:**
- Create: `install/com.claude.streamdeck.plist`
- Create: `install/install.sh`

- [ ] **Step 1: Create launchd plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude.streamdeck.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>__NODE_BIN__</string>
        <string><repo>/server/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/claude-streamdeck.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/claude-streamdeck.err</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
```

- [ ] **Step 2: Create install script**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_SRC="$PROJECT_DIR/plugin/com.claude.streamdeck.sdPlugin"
PLUGIN_DST="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/com.claude.streamdeck.sdPlugin"
PLIST_SRC="$SCRIPT_DIR/com.claude.streamdeck.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.claude.streamdeck.plist"

echo "=== Claude Stream Deck Installer ==="

# 1. Install server dependencies
echo "[1/4] Installing server dependencies..."
cd "$PROJECT_DIR/server"
npm install --production

# 2. Install Stream Deck plugin
echo "[2/4] Installing Stream Deck plugin..."
if [ -L "$PLUGIN_DST" ] || [ -d "$PLUGIN_DST" ]; then
  echo "  Removing existing plugin..."
  rm -rf "$PLUGIN_DST"
fi
ln -s "$PLUGIN_SRC" "$PLUGIN_DST"
echo "  Symlinked plugin to $PLUGIN_DST"

# 3. Install launchd plist
echo "[3/4] Installing launchd service..."
if launchctl list | grep -q com.claude.streamdeck.server 2>/dev/null; then
  echo "  Unloading existing service..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi
cp "$PLIST_SRC" "$PLIST_DST"
launchctl load "$PLIST_DST"
echo "  Service installed and started"

# 4. Restart Stream Deck
echo "[4/4] Restarting Stream Deck app..."
killall "Stream Deck" 2>/dev/null || true
sleep 2
open -a "Elgato Stream Deck"

echo ""
echo "=== Installation complete ==="
echo "Server logs: /tmp/claude-streamdeck.log"
echo "Server errors: /tmp/claude-streamdeck.err"
echo ""
echo "Next: Open the Stream Deck app, drag 'Claude Session' buttons onto your profile."
```

- [ ] **Step 3: Make install.sh executable**

Run: `chmod +x <repo>/install/install.sh`

- [ ] **Step 4: Commit**

```bash
git add install/
git commit -m "feat: add installation script and launchd plist"
```

---

### Task 6: Update Claude Code Hooks

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Read current settings.json to confirm latest state**

Run: `cat ~/.claude/settings.json`

- [ ] **Step 2: Add curl to each hook**

For every hook in `settings.json`, append a `; curl ...` fire-and-forget call after the existing command. The pattern:

**SessionStart hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"idle","color":{"r":0,"g":200,"b":0}}' &
```

**UserPromptSubmit hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"thinking","color":{"r":30,"g":100,"b":255}}' &
```

**PreToolUse (catch-all matcher "") hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"tool_use","color":{"r":30,"g":100,"b":255},"detail":"'"$tool"'"}' &
```

Where `$tool` is extracted from the JSON input (already done in the existing hooks).

**PostToolUse hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"thinking","color":{"r":30,"g":100,"b":255}}' &
```

**PostToolUseFailure hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"error","color":{"r":255,"g":0,"b":0}}' &
```

**PermissionRequest hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"permission","color":{"r":255,"g":165,"b":0}}' &
```

**Stop hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"done","color":{"r":0,"g":200,"b":0}}' &
```

**StopFailure hook — add:**
```bash
; curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{"session":"'"$(basename "$PWD")"'","state":"error","color":{"r":255,"g":0,"b":0}}' &
```

- [ ] **Step 3: Test hooks manually**

Start the server:
```bash
cd <repo>/server && node index.js &
```

Test the curl:
```bash
curl -s -X POST http://localhost:7842/state \
  -H 'Content-Type: application/json' \
  -d '{"session":"test-project","state":"thinking","color":{"r":30,"g":100,"b":255}}'
```

Expected: `{"ok":true,"buttonIndex":0}`

Then check health:
```bash
curl http://localhost:7842/health
```

Expected: `{"status":"ok","sessions":1}`

Kill the test server:
```bash
kill %1
```

- [ ] **Step 4: Commit settings.json changes**

Note: `~/.claude/settings.json` is outside the project repo. No git commit for this file — just verify it works.

---

### Task 7: End-to-End Manual Test

**Files:** None — verification only.

- [ ] **Step 1: Run install script**

```bash
cd <repo> && ./install/install.sh
```

- [ ] **Step 2: Verify server is running**

```bash
curl http://localhost:7842/health
```

Expected: `{"status":"ok","sessions":0}`

- [ ] **Step 3: Open Stream Deck app and configure buttons**

1. Open the Stream Deck app
2. Find "Claude Code" category in the action list
3. Drag 5 "Claude Session" actions onto the Stream Deck profile (one per expected session)
4. The buttons should appear dark/empty initially

- [ ] **Step 4: Test state update via curl**

```bash
curl -s -X POST http://localhost:7842/state -H 'Content-Type: application/json' \
  -d '{"session":"my-project","state":"thinking","color":{"r":30,"g":100,"b":255}}'
```

Expected: First button should turn blue with "my-project" text.

- [ ] **Step 5: Test tab switching**

1. Open iTerm2 with at least 2 tabs
2. Press the first button on Stream Deck
3. Expected: iTerm2 activates and selects tab 1

- [ ] **Step 6: Test full flow with Claude Code**

1. Start a Claude Code session in an iTerm2 tab
2. Send a prompt
3. Expected: The corresponding Stream Deck button changes color through the states (thinking → tool_use → done)

- [ ] **Step 7: Commit any final adjustments**

```bash
cd <repo>
git add -A
git commit -m "fix: adjustments from end-to-end testing"
```

(Only if changes were needed.)
