const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const originalLoad = Module._load;
const platform = Object.getOwnPropertyDescriptor(process, 'platform');
Object.defineProperty(process, 'platform', { value: 'darwin' });
let fail = false, paths = [], calls = [];
Module._load = function(name, ...args) {
  if (name === 'child_process') return { execFile(file, args, options, callback) {
    calls.push([file, args]);
    const target = args.at(-1); paths.push(target);
    assert.equal(fs.statSync(path.dirname(target)).mode & 0o777, 0o700);
    assert.equal(options.timeout, 5000);
    if (fail) return callback(new Error('native failure'));
    fs.writeFileSync(target, Buffer.from('jpeg'));
    callback(null, '', '');
  } };
  return originalLoad.call(this, name, ...args);
};
const { capturePrimaryScreen, nativeResizeJpeg } = require('../src/native-capture.ts');
Module._load = originalLoad;
test('macOS uses native argv APIs and cleans private frame files on success and failure', async () => {
  try {
    assert.equal((await capturePrimaryScreen()).toString(), 'jpeg');
    assert.equal((await nativeResizeJpeg(Buffer.from('raw'), { width: 1440, height: 900 }, 85)).toString(), 'jpeg');
    assert.equal(calls[0][0], '/usr/sbin/screencapture');
    assert.deepEqual(calls[0][1].slice(0, -1), ['-x', '-m', '-t', 'jpg']);
    assert.equal(calls[1][0], '/usr/bin/sips');
    assert.deepEqual(calls[1][1].slice(0, -1), ['--resampleHeightWidth', '900', '1440', '-s', 'formatOptions', '85']);
    fail = true;
    await assert.rejects(capturePrimaryScreen(), /native failure/);
    await assert.rejects(nativeResizeJpeg(Buffer.from('raw'), { width: 1440, height: 900 }, 85), /native failure/);
    for (const target of paths) assert.equal(fs.existsSync(path.dirname(target)), false);
  } finally { Object.defineProperty(process, 'platform', platform); }
});
