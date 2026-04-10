# Claude Code hooks snippet

Add these hooks to `~/.claude/settings.json` so that each Claude Code event
pushes a session state update to the stream-deck server. The `tabIndex` field
is resolved by the helper script `~/.claude/bin/claude-sd-tab-index.sh` (copied
there by `install/install.sh`), which identifies the iTerm2 tab hosting the
current Claude session via its controlling TTY.

> **macOS / iTerm2 only.** The helper relies on AppleScript talking to iTerm2.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"idle\",\"color\":{\"r\":0,\"g\":200,\"b\":0},\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"thinking\",\"color\":{\"r\":30,\"g\":100,\"b\":255},\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "input=$(cat); tool=$(echo \"$input\" | jq -r '.tool_name // empty'); curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"tool_use\",\"color\":{\"r\":30,\"g\":100,\"b\":255},\"detail\":\"'\"$tool\"'\",\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"thinking\",\"color\":{\"r\":30,\"g\":100,\"b\":255},\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"error\",\"color\":{\"r\":255,\"g\":0,\"b\":0},\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"permission\",\"color\":{\"r\":255,\"g\":165,\"b\":0},\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"done\",\"color\":{\"r\":0,\"g\":200,\"b\":0},\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ],
    "StopFailure": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s --max-time 1 -X POST http://localhost:7842/state -H 'Content-Type: application/json' -d '{\"session\":\"'\"$(basename \"$PWD\")\"'\",\"state\":\"error\",\"color\":{\"r\":255,\"g\":0,\"b\":0},\"tabIndex\":'\"$(~/.claude/bin/claude-sd-tab-index.sh \"$(basename \"$PWD\")\")\"'}' &"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

If button assignments seem wrong (events routed to the wrong tab), check
`/tmp/claude-sd-debug.log` to see what TTY the helper resolved and whether
iTerm2 matched it to a tab. Each hook invocation appends one line:

```
2026-04-10T11:19:19 session=my-project method=ps-self tty=/dev/ttys002 idx=4 pid=72336 ppid=72333
```

- `idx=NOMATCH` means the resolved TTY did not correspond to any iTerm2 session
  in the current window — the helper falls back to `0`.
- `method=ps-self` is the expected fast path; `ps-parent` is a fallback.
