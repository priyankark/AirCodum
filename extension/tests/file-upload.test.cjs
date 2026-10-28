const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'aircodum-upload-dogfood-'));
const messages = [];
const original = Module._load;
Module._load = function(name, ...args) {
  if (name === 'vscode') return { workspace: { workspaceFolders: [{ uri: { fsPath: workspace } }] }, window: { showInformationMessage() {} } };
  if (name === '../state/store') return { store: { getState: () => ({ currentContext: {}, webview: { panel: { webview: { postMessage: value => messages.push(value) } } } }) } };
  if (name === '../ai/utils') return { getApiKey: () => undefined };
  if (name === '../ai/api') return { transcribeImage() { throw Error('File transfer must not call an AI service'); } };
  if (name === '../utils') return { resizeImage() { throw Error('Text upload must not invoke image processing'); } };
  return original.call(this, name, ...args);
};
const { handleFileUpload } = require('../src/files/utils.ts');
Module._load = original;
test('a successful file upload without an optional AI key is not shown as an error', async () => {
  try {
    const contents = Buffer.from('Phone upload 🌍\n');
    await handleFileUpload(contents, { send() {} });
    assert.equal(messages.filter(m => m.type === 'error').length, 0);
    const saved = messages.find(m => m.type === 'file');
    assert(saved, 'Webview must receive the saved-file event');
    assert(fs.readFileSync(saved.filePath).equals(contents));
    assert.equal(path.dirname(saved.filePath), path.join(workspace, 'AirCodum'));
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
