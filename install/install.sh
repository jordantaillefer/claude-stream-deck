#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_SRC="$PROJECT_DIR/plugin/com.claude.streamdeck.sdPlugin"
PLUGIN_DST="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/com.claude.streamdeck.sdPlugin"
PLIST_SRC="$SCRIPT_DIR/com.claude.streamdeck.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.claude.streamdeck.plist"
HELPER_SRC="$SCRIPT_DIR/claude-sd-tab-index.sh"
HELPER_DST="$HOME/.claude/bin/claude-sd-tab-index.sh"

echo "=== Claude Stream Deck Installer ==="

# 1. Install server dependencies
echo "[1/5] Installing server dependencies..."
cd "$PROJECT_DIR/server"
npm install --production

# 2. Install Stream Deck plugin
echo "[2/5] Installing Stream Deck plugin..."
if [ -L "$PLUGIN_DST" ] || [ -d "$PLUGIN_DST" ]; then
  echo "  Removing existing plugin..."
  rm -rf "$PLUGIN_DST"
fi
ln -s "$PLUGIN_SRC" "$PLUGIN_DST"
echo "  Symlinked plugin to $PLUGIN_DST"

# 3. Install launchd plist (with placeholder substitution)
echo "[3/5] Installing launchd service..."
if launchctl list | grep -q com.claude.streamdeck.server 2>/dev/null; then
  echo "  Unloading existing service..."
  launchctl unload "$PLIST_DST" 2>/dev/null || true
fi
NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "  ERROR: node not found in PATH — install Node.js first." >&2
  exit 1
fi
mkdir -p "$(dirname "$PLIST_DST")"
sed -e "s|__NODE_BIN__|$NODE_BIN|g" \
    -e "s|__PROJECT_DIR__|$PROJECT_DIR|g" \
    "$PLIST_SRC" > "$PLIST_DST"
launchctl load "$PLIST_DST"
echo "  Service installed and started (node: $NODE_BIN)"

# 4. Install iTerm2 tab-index helper
echo "[4/5] Installing Claude Code hook helper..."
mkdir -p "$(dirname "$HELPER_DST")"
cp "$HELPER_SRC" "$HELPER_DST"
chmod +x "$HELPER_DST"
echo "  Helper installed to $HELPER_DST"

# 5. Restart Stream Deck
echo "[5/5] Restarting Stream Deck app..."
killall "Stream Deck" 2>/dev/null || true
sleep 2
open -a "Elgato Stream Deck"

echo ""
echo "=== Installation complete ==="
echo "Server logs: /tmp/claude-streamdeck.log"
echo "Server errors: /tmp/claude-streamdeck.err"
echo ""
echo "Next steps:"
echo "  1. Open the Stream Deck app, drag 'Claude Session' buttons onto your profile."
echo "  2. Add the Claude Code hooks from install/claude-hooks-snippet.md to"
echo "     ~/.claude/settings.json so sessions push state to the server."
