const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validScroll, validMouse } = require('../src/security.ts');
const { nativeScrollDelta } = require('../src/vnc-input.ts');

test('scroll rejects unsafe native arguments and accepts both axes', () => {
  const event = { x: 120, y: 80, screenWidth: 1440, screenHeight: 900, deltaX: -2, deltaY: 3 };
  assert.equal(validScroll(event), true);
  for (const patch of [{ deltaX: NaN }, { deltaY: Infinity }, { deltaY: 121 }, { deltaX: -121 },
    { deltaX: .5 }, { deltaX: 0, deltaY: 0 }, { x: -1 }, { y: 901 }, { screenWidth: 0 }, { button: 'middle' }]) {
    assert.equal(validScroll({ ...event, ...patch }), false);
  }
  assert.equal(validMouse({ ...event, eventType: 'down', button: 'right' }), true);
  assert.equal(validMouse({ ...event, eventType: 'down', button: 'invalid' }), false);
});

test('wheel ticks preserve direction with each platform native units', () => {
  assert.equal(nativeScrollDelta(-2, 'darwin'), -24);
  assert.equal(nativeScrollDelta(3, 'win32'), 360);
  assert.equal(nativeScrollDelta(-2, 'linux'), -2);
  assert.equal(nativeScrollDelta(0, 'win32'), 0);
});
