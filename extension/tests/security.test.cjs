const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocketServer, WebSocket } = require('ws');
const { authorized, messageBudget, validMouse, validKey } = require('../src/security.ts');
const token = 'a'.repeat(64);

test('authentication rejects missing/wrong credentials, query tokens and browser origins', () => {
  const auth = headers => authorized({ headers }, token);
  assert.equal(auth({}), false);
  assert.equal(auth({ authorization: 'Bearer ' + 'b'.repeat(64) }), false);
  assert.equal(auth({ authorization: 'Bearer short' }), false);
  assert.equal(auth({ authorization: 'Bearer ' + token, origin: 'https://attacker.example' }), false);
  assert.equal(auth({ authorization: 'Bearer ' + token }), true);
  assert.equal(authorized({ headers: { authorization: 'Bearer short' } }, 'short'), false);
});

test('limits reject floods and invalid native input before dispatch', () => {
  const budget = messageBudget();
  for (let i = 0; i < 240; i++) assert.equal(budget(1), true);
  assert.equal(budget(1), false);
  assert.equal(messageBudget()(9 * 1024 * 1024), false);
  assert.equal(validMouse({ eventType: 'down', x: NaN, y: 0, screenWidth: 1, screenHeight: 1 }), false);
  assert.equal(validMouse({ eventType: 'down', x: 1, y: 0, screenWidth: 0, screenHeight: 1 }), false);
  assert.equal(validMouse({ eventType: 'move', x: 1, y: 0, screenWidth: 10, screenHeight: 10 }), true);
  assert.equal(validKey({ key: 'constructor' }), false);
  assert.equal(validKey({ key: 'a', modifier: ['unknown'] }), false);
  assert.equal(validKey({ key: 'a', modifier: ['command', 'shift'] }), true);
});

test('real upgrade handshake exposes no connection before authentication', async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0, maxPayload: 64,
    verifyClient: ({ req }) => authorized(req, token) });
  await once(server, 'listening');
  let connections = 0;
  server.on('connection', socket => { connections++; socket.on('error', () => {}); });
  const url = `ws://127.0.0.1:${server.address().port}`;
  try {
    for (const options of [{}, { headers: { authorization: 'Bearer wrong' } }, { headers: { authorization: 'Bearer ' + token, origin: 'https://example.com' } }]) {
      const client = new WebSocket(url, options);
      await new Promise(resolve => client.once('error', resolve));
      assert.equal(connections, 0);
    }
    const client = new WebSocket(url, { headers: { authorization: 'Bearer ' + token } });
    await once(client, 'open');
    assert.equal(connections, 1);
    const closed = once(client, 'close');
    client.send('x'.repeat(65));
    assert.equal((await closed)[0], 1009);
  } finally { for (const client of server.clients) client.terminate(); await new Promise(resolve => server.close(resolve)); }
});
