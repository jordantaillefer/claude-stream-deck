// server/index.js
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { SessionManager } from './session-manager.js';
import { renderButton, svgToDataUri } from './button-renderer.js';
import { colorForState } from './icons.js';

const DEFAULT_PORT = 7842;
const MAX_BODY_SIZE = 10 * 1024; // 10 KB

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
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body too large' }));
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.session || !data.state) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing required fields: session, state' }));
            return;
          }

          // color is optional — derive it from state when the hook omits it.
          const color = data.color || colorForState(data.state);
          const session = sessionManager.update({ ...data, color });
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
    ws.on('error', () => {});
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
