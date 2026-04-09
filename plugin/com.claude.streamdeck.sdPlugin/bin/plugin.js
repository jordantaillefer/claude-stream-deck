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
      const { column, row } = msg.payload.coordinates;
      const buttonIndex = row * 4 + column; // 4 columns x 3 rows = 12 buttons
      buttonContexts.set(buttonIndex, msg.context);
      contextButtons.set(msg.context, buttonIndex);

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
  const script = `tell application "iTerm2" to activate
tell application "iTerm2" to tell current window to select tab ${tabIndex}`;
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
