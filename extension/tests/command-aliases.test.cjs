const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const calls = [];
let finish;
Module._load = function(name, ...args) {
  if (name === 'vscode') return { commands: { executeCommand(id) {
    calls.push(id); return new Promise(resolve => { finish = resolve; });
  } } };
  if (['./robotjs-handlers', '../ai/api', '../ai/utils', './screenshot-handler', '../state/store'].includes(name)) return {};
  return originalLoad.call(this, name, ...args);
};
const { handleCommand } = require('../src/commanding/command-handler.ts');
const { BuiltInCommands, resolveBuiltInCommand } = require('../src/commanding/commands.ts');
Module._load = originalLoad;

test('command catalog presents each VS Code action once', () => {
  const commands = Object.values(BuiltInCommands);
  assert.equal(new Set(commands).size, commands.length);
});
test('saved command names and case variants retain their original actions', () => {
  for (const [name, id] of [
    ['Move Cursor to Line End', 'cursorLineEnd'],
    ['Open settings', 'workbench.action.openSettings'],
    ['Show Keyboard Shortcuts', 'workbench.action.openGlobalKeybindings'],
    ['Toggle Side Bar', 'workbench.action.toggleSidebarVisibility'],
    ['Create New Terminal', 'workbench.action.terminal.new'],
    ['Next Marker In Files', 'editor.action.marker.nextInFiles'],
  ]) {
    assert.equal(resolveBuiltInCommand(name), id);
    assert.equal(resolveBuiltInCommand(name.toUpperCase()), id);
  }
  for (const name of ['constructor', '__proto__', 'unknown command']) assert.equal(resolveBuiltInCommand(name), undefined);
});
test('legacy alias execution waits for VS Code before acknowledging completion', async () => {
  let completed = false;
  const command = handleCommand('MOVE CURSOR TO LINE END', {}).then(() => { completed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['cursorLineEnd']);
  assert.equal(completed, false);
  finish(); await command;
  assert.equal(completed, true);
});

test('case-sensitive historical actions remain distinct when their lowercase names collide', () => {
  assert.equal(resolveBuiltInCommand('Go To Next Reference'), 'goToNextReference');
  assert.equal(resolveBuiltInCommand('Go to next reference'), 'references-view.next');
  assert.equal(resolveBuiltInCommand('GO TO NEXT REFERENCE'), undefined, 'ambiguous capitalization must not select the wrong action');
});
