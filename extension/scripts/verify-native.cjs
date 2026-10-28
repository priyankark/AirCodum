'use strict';
const assert = require('node:assert/strict');
const { deflateSync } = require('node:zlib');
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(name, bytes) {
  const type = Buffer.from(name), output = Buffer.alloc(bytes.length + 12);
  output.writeUInt32BE(bytes.length); type.copy(output, 4); bytes.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([type, bytes])), output.length - 4);
  return output;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(1); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 2;
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0]))), chunk('IEND', Buffer.alloc(0))]);
async function verifyNative(packagePath) {
  const native = require(require('node:path').resolve(packagePath));
  assert.equal(typeof native.getPermissions(), 'object');
  assert.equal(typeof native.typeString, 'function');
  const frame = await native.resizeImage(png, 1, null, 85, 'jpeg');
  assert.deepEqual([frame.width, frame.height], [1, 1]);
  assert.equal(frame.data.subarray(0, 2).toString('hex'), 'ffd8');
  const decoded = await native.resizeImage(frame.data, 1, null, 85, 'png');
  assert.equal(decoded.data.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  await assert.rejects(native.resizeImage(Buffer.from('invalid'), 1));
  console.log(`VSIX native runtime passed on ${process.platform}/${process.arch}`);
}
module.exports = verifyNative;
if (require.main === module) verifyNative(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
