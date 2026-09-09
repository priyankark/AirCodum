// Opt-in integration runner loaded by VS Code --extensionTestsPath.
// Uses the actual extension host, SecretStorage, native addon and editor APIs.
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(50); }
  throw Error('VS Code assertion timed out');
}
exports.run = async () => {
  const directory = process.env.AIRCODUM_VSCODE_E2E_DIR;
  const transportOnly = process.env.AIRCODUM_E2E_TRANSPORT_ONLY === '1';
  const mode = transportOnly ? 'transport' : 'desktop';
  assert.ok(directory, 'Set AIRCODUM_VSCODE_E2E_DIR to an isolated test directory');
  const write = (name, data) => fs.writeFileSync(path.join(directory, name), JSON.stringify(data), { mode: 0o600 });
  const extension = vscode.extensions.getExtension('priyankark.aircodum-app');
  assert.ok(extension, 'Actual AirCodum extension must be installed in development host');
  await extension.activate();
  assert.equal(extension.isActive, true);
  await vscode.commands.executeCommand('extension.startAirCodumServer');
  await until(() => vscode.window.tabGroups.all.flatMap(group => group.tabs).some(tab => tab.label === 'AirCodum'));
  const clipboard = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('extension.copyAirCodumPairingToken');
  const token = await vscode.env.clipboard.readText();
  assert.match(token, /^[a-f0-9]{64}$/);
  await vscode.env.clipboard.writeText(clipboard);
  const url = 'ws://127.0.0.1:11040';
  const bad = new WebSocket(url);
  await new Promise(resolve => bad.once('error', resolve));
  const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${token}`, Origin: 'aircodum://native' } });
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(raw)));
  await once(socket, 'open');
  await until(() => messages.some(m => m.type === 'server_capabilities'));
  assert.equal(messages[0].features.vncSharedPort, true);
  await delay(200);
  assert.equal(messages.some(m => m.type === 'screen-update'), false, 'No unsolicited capture');
  const filePath = path.join(directory, 'workspace', 'native-editor.txt');
  fs.writeFileSync(filePath, 'fixture');
  const document = await vscode.workspace.openTextDocument(filePath);
  const focus = async () => {
    if (process.platform === 'darwin') {
      const { execFileSync } = require('node:child_process');
      const line = execFileSync('ps', ['-Ao', 'pid,command'], { encoding: 'utf8' }).split('\n')
        .find(line => line.includes('/Contents/MacOS/Code --new-window') && line.includes(`--user-data-dir ${directory}/profile`));
      const pid = Number(line?.trim().split(/\s/)[0]);
      assert.ok(Number.isInteger(pid) && pid > 0, 'Find only the isolated VS Code process');
      execFileSync('osascript', ['-e', `tell application "System Events" to set frontmost of first application process whose unix id is ${pid} to true`]);
    }
    await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await until(() => vscode.window.state.focused);
    await delay(300); // Allow the editor's DOM focus to settle before native/command input.
  };
  if (!transportOnly) {
    await focus();
    const editor = vscode.window.activeTextEditor;
    socket.send('Select All');
    await until(() => editor.document.getText(editor.selection) === 'fixture');
    socket.send('Move Cursor to End');
    await until(() => editor.selection.isEmpty);
    socket.send(JSON.stringify({ type: 'vnc_start' }));
    await until(() => messages.some(m => m.type === 'screen-update'));
    const frame = messages.find(m => m.type === 'screen-update');
    assert.ok(frame.dimensions.width > 0 && frame.dimensions.height > 0);
    assert.equal(Buffer.from(frame.image, 'base64').subarray(0, 2).toString('hex'), 'ffd8');
    socket.send(JSON.stringify({ type: 'vnc_stop' }));
  }
  socket.close();
  const snapshot = () => write('editor-state.json', { text: document.getText(), dirty: document.isDirty });
  const subscription = vscode.workspace.onDidChangeTextDocument(event => { if (event.document === document) snapshot(); });
  snapshot();
  write('ready.json', { mode, token, port: 11040, filePath, vscodeVersion: vscode.version,
    checks: ['real extension activated', 'real webview opened', 'SecretStorage pairing command', 'anonymous upgrade rejected',
      'capabilities announced', ...(!transportOnly ? ['capture only on demand', 'VS Code Select All/Move Cursor commands', 'native JPEG captured'] : [])] });
  let lastId;
  try {
    const deadline = Date.now() + 45 * 60 * 1000;
    while (Date.now() < deadline) {
      const requestPath = path.join(directory, 'request.json');
      if (fs.existsSync(requestPath)) {
        let request;
        try { request = JSON.parse(fs.readFileSync(requestPath, 'utf8')); } catch { await delay(100); continue; }
        if (request.id !== lastId) {
          lastId = request.id;
          try {
            if (request.action === 'focus') await focus();
            else if (request.action === 'assertSelection') assert.equal(document.getText(vscode.window.activeTextEditor.selection), request.text);
            else if (request.action === 'assertText') assert.equal(document.getText(), request.text);
            else if (request.action === 'restart') {
              await vscode.commands.executeCommand('extension.stopAirCodumServer');
              await vscode.commands.executeCommand('extension.startAirCodumServer');
              const before = await vscode.env.clipboard.readText();
              await vscode.commands.executeCommand('extension.copyAirCodumPairingToken');
              assert.equal(await vscode.env.clipboard.readText(), token, 'Restart must retain the pairing token');
              await vscode.env.clipboard.writeText(before);
              if (!transportOnly) await focus();
            } else if (request.action === 'finish') {
              await document.save();
              write('response.json', { id: lastId, pass: true });
              write('result.json', { pass: true, mode, vscodeVersion: vscode.version, text: document.getText() });
              return;
            } else throw Error('Unknown test action');
            snapshot();
            write('response.json', { id: lastId, pass: true });
          } catch (error) { write('response.json', { id: lastId, pass: false, error: error.message }); }
        }
      }
      await delay(100);
    }
    throw Error('Android test did not finish within 45 minutes');
  } finally {
    subscription.dispose();
    await vscode.commands.executeCommand('extension.stopAirCodumServer');
  }
};
