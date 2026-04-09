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
        const parsed = JSON.parse(data.toString());
        if (parsed.session && parsed.session.session === 'ws-test') {
          resolve(parsed);
          ws.close();
        }
      });
    });

    assert.equal(message.type, 'state_update');
    assert.equal(message.session.session, 'ws-test');
    assert.ok(message.image.startsWith('data:image/svg+xml;base64,'));
  });
});
