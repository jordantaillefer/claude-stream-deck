#!/bin/bash
# Resolves the iTerm2 tab index (0-based) hosting the current shell.
# Used by Claude Code hooks to send the correct tabIndex to the stream-deck server.
#
# Usage: claude-sd-tab-index.sh [session-name]
# Output: the 0-based tab index, or 0 if detection fails.
#
# Diagnostics are appended to /tmp/claude-sd-debug.log.

LOG=/tmp/claude-sd-debug.log
SESSION="${1:-unknown}"

# Resolve the controlling TTY of the hook shell.
# `tty </dev/tty` does NOT work on macOS — /dev/tty is not dereferenced to the
# real device path, so iTerm2 can never match it. Use `ps -o tty=` instead.
T1=$(ps -p $$ -o tty= 2>/dev/null | tr -d ' ')
[ -n "$T1" ] && [ "$T1" != "??" ] && T1="/dev/$T1" || T1=""

T2=$(ps -p $PPID -o tty= 2>/dev/null | tr -d ' ')
[ -n "$T2" ] && [ "$T2" != "??" ] && T2="/dev/$T2" || T2=""

T=""
METHOD=""
if [ -n "$T1" ]; then
  T="$T1"; METHOD="ps-self"
elif [ -n "$T2" ]; then
  T="$T2"; METHOD="ps-parent"
fi

IDX=$(osascript \
  -e 'on run argv' \
  -e 'set t to item 1 of argv' \
  -e 'tell application "iTerm2"' \
  -e 'tell current window' \
  -e 'set tl to tabs' \
  -e 'repeat with i from 1 to count of tl' \
  -e 'repeat with s in sessions of item i of tl' \
  -e 'try' \
  -e 'if tty of s is t then return (i - 1) as string' \
  -e 'end try' \
  -e 'end repeat' \
  -e 'end repeat' \
  -e 'return "NOMATCH"' \
  -e 'end tell' \
  -e 'end tell' \
  -e 'end run' \
  -- "$T" 2>>"$LOG")

printf '%s session=%s method=%s tty=%s idx=%s pid=%s ppid=%s\n' \
  "$(date '+%Y-%m-%dT%H:%M:%S')" "$SESSION" "$METHOD" "$T" "$IDX" "$$" "$PPID" >> "$LOG" 2>/dev/null || true

if [ "$IDX" = "NOMATCH" ] || [ -z "$IDX" ]; then
  echo 0
else
  echo "$IDX"
fi
