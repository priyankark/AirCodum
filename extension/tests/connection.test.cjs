const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tailscaleAddresses, connectionDetails } = require('../src/connection.ts');

test('connection choices contain detected Tailscale addresses, never public or LAN adapters', () => {
  const address = (address, internal = false) => ({ address, internal });
  assert.deepEqual(tailscaleAddresses({
    lo: [address('127.0.0.1', true)],
    en0: [address('192.168.1.2'), address('10.0.0.2'), address('8.8.8.8')],
    utun: [address('100.89.59.102'), address('fd7a:115c:a1e0::1234')],
    duplicate: [address('100.89.59.102')],
  }), ['100.89.59.102']);
  assert.deepEqual(tailscaleAddresses({}), []);
});

test('panel reports the actual listener until restarted, and explains local-only access', () => {
  const server = { isRunning: true, address: '127.0.0.1', port: 11040 };
  const active = connectionDetails(server, '100.89.59.102');
  assert.equal(active.host, '127.0.0.1');
  assert.match(active.hint, /only from this Mac/);
  const stopped = connectionDetails({ ...server, isRunning: false }, '100.89.59.102');
  assert.equal(stopped.host, '100.89.59.102');
  assert.match(stopped.hint, /Server stopped/);
  assert.equal(connectionDetails({ ...server, address: '100.89.59.102' }, '127.0.0.1').running, true);
});

const { pairingCode } = require('../src/connection.ts');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
test('pairing image decodes to the complete versioned phone connection', async () => {
 const token='a'.repeat(64);
 const payload=pairingCode({isRunning:true,address:'100.89.59.102',port:11040},token);
 const png=PNG.sync.read(await QRCode.toBuffer(payload,{width:640,margin:4,errorCorrectionLevel:'M'}));
 const decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.equal(decoded.data,payload);
 assert.deepEqual(JSON.parse(decoded.data),{type:'aircodum-pairing',version:1,host:'100.89.59.102',port:11040,tls:false,token});
 for(const state of [{isRunning:false,address:'100.89.59.102',port:11040},{isRunning:true,address:'127.0.0.1',port:11040}]) assert.throws(()=>pairingCode(state,token));
});
