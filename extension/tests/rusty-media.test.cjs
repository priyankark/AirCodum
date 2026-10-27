const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let resolveCapture, calls = [], fail = false;
const addon = { captureFrame(...args) {
  calls.push(args);
  if (fail) { fail = false; return Promise.reject(Error('native permission failure')); }
  return new Promise(resolve => { resolveCapture = resolve; });
} };
const native = { getScreenSize() { throw Error('No main display is available'); } };
Module._load = function(name, ...args) {
  if (name === './rusty-media') return { useRustMedia: () => true, loadRustMedia: () => addon };
  if (name === './native-capture') return { capturePrimaryScreen() { throw Error('Must not use OS subprocess capture'); } };
  if (name === './input-handler') return native;
  if (name === './commanding/robotjs-handlers') return { typedRobot: native };
  if (['vscode', './commanding/command-handler', './files/utils', './ai/api', './ai/utils'].includes(name)) return {};
  return original.call(this, name, ...args);
};
const { ScreenCaptureManager } = require('../src/websockets.ts');
Module._load = original;
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const result = (data = Buffer.from('jpeg'), width = 1440) => ({ data, width, height: 810, fingerprint: 'hash', changed: Boolean(data) });
test('Rust capture can subscribe without a display and recover when it returns', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  const manager = ScreenCaptureManager.getInstance();
  manager.updateQualitySettings({ width: 1280 });
  const frames = [];
  fail = true;
  const stop = manager.subscribe((frame, dimensions) => frames.push(dimensions));
  await settle();
  assert.equal(frames.length, 0);
  t.mock.timers.tick(40); await settle();
  resolveCapture(result(Buffer.from('recovered'), 1280)); await settle();
  assert.deepEqual(frames, [{ width: 1280, height: 810 }]);
  stop(); manager.updateQualitySettings({ width: 1440 });
  calls = [];
});

test('Rust workers preserve single-flight, idle suppression, refresh, quality invalidation, failure recovery and stop', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 10000 });
  const manager = ScreenCaptureManager.getInstance(); const frames = [];
  const stop = manager.subscribe((frame, dimensions) => frames.push({ frame, dimensions }));
  assert.equal(calls.length, 1);
  t.mock.timers.tick(100); await settle(); assert.equal(calls.length, 1, 'no overlapping work');
  resolveCapture(result()); await settle(); assert.equal(frames.length, 1);
  t.mock.timers.tick(40); await settle(); assert.equal(calls[1][2], 'hash'); assert.equal(calls[1][3], false);
  resolveCapture(result(null)); await settle(); assert.equal(frames.length, 1, 'unchanged frame is not sent');
  t.mock.timers.tick(40); await settle(); manager.updateQualitySettings({ width: 1280 });
  resolveCapture(result()); await settle(); assert.equal(frames.length, 1, 'old quality result is discarded');
  t.mock.timers.tick(40); await settle(); assert.equal(calls.at(-1)[0], 1280); assert.equal(calls.at(-1)[2], null);
  resolveCapture(result(Buffer.from('new'),1280)); await settle(); assert.equal(frames.length, 2);
  fail = true; t.mock.timers.tick(40); await settle();
  t.mock.timers.tick(1100); await settle(); assert.equal(calls.at(-1)[3], true, 'periodic recovery refresh');
  resolveCapture(result(Buffer.from('refresh'),1280)); await settle(); assert.equal(frames.length, 3);
  t.mock.timers.tick(40); await settle(); const count = calls.length; stop();
  resolveCapture(result()); await settle(); assert.equal(frames.length, 3, 'late completion is dropped after stop');
  t.mock.timers.tick(1000); await settle(); assert.equal(calls.length, count);
  manager.shutdown?.();
});


test('invalid remote quality settings cannot poison the Rust capture loop', () => {
  const manager = ScreenCaptureManager.getInstance();
  const before = manager.getQualitySettings();
  for (const [field, valid] of [['width', 1280], ['jpegQuality', 85], ['fps', 30]]) {
    for (const value of [valid + 0.5, String(valid), null, NaN, Infinity, -1, 1e8]) {
      manager.updateQualitySettings({ [field]: value });
      assert.deepEqual(manager.getQualitySettings(), before, `${field} must reject ${String(value)}`);
    }
  }
  manager.shutdown?.();
});
