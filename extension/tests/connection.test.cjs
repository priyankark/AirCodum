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
const { localNetworkAddresses } = require('../src/connection.ts');
const { allowedBind, protectedBind, localNetworkAddress } = require('../src/security.ts');
test('LAN pairing admits only explicit private IPv4 interfaces and keeps public listeners blocked', () => {
 const accepted = ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.2'];
 for (const host of accepted) {
  assert.equal(localNetworkAddress(host), true);
  assert.equal(allowedBind(host), true);
  assert.equal(protectedBind(host), false, 'Local Wi-Fi is not described as encrypted');
  assert.equal(JSON.parse(pairingCode({isRunning:true,address:host,port:11040}, 'a'.repeat(64))).host,host);
 }
 for (const host of ['0.0.0.0','::','8.8.8.8','172.15.0.1','172.32.0.1','192.169.1.2','169.254.1.1','192.168.999.1','010.0.0.1','localhost.example']) {
  assert.equal(allowedBind(host),false,host);
  assert.throws(()=>pairingCode({isRunning:true,address:host,port:11040},'a'.repeat(64)));
 }
 assert.deepEqual(localNetworkAddresses({en0:accepted.map(address=>({address,internal:false})),lo:[{address:'10.2.3.4',internal:true}],public:[{address:'8.8.8.8',internal:false}]}),accepted);
 assert.equal(connectionDetails({isRunning:true,address:'192.168.1.2',port:11040},'127.0.0.1').localNetwork,true);
});
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
