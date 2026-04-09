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
