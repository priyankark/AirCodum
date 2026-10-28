'use strict';
// Opt-in user journey through the exact VSIX, real VS Code and native desktop.
// Run scripts/verify-vscode-host.cjs <archive> --desktop on an unlocked desktop.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { Jimp } = require('jimp');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await pause(25); }
  throw Error(`Timed out: ${description}`);
}
const event = (emitter, name) => once(emitter, name, { signal: AbortSignal.timeout(10000) });
exports.run = async extension => {
  const vscode = require('vscode');
  const root = process.env.AIRCODUM_DOGFOOD_ROOT;
  assert(root, 'Use the isolated packaged-host launcher');
  const native = require(path.join(extension.extensionPath, 'dist/rusty-robot'));
  const permissions = native.getPermissions();
  assert.notEqual(permissions.accessibility, false, 'Accessibility must be granted to the VS Code host');
  assert.notEqual(permissions.screenCapture, false, 'Screen Recording must be granted to the VS Code host');
  const originalPointer = native.getMousePos();
  const clipboard = await vscode.env.clipboard.readText();
  const checks = [], sockets = new Set();
  let document;
  async function token() {
    try {
      await vscode.commands.executeCommand('extension.copyAirCodumPairingToken');
      const value = await vscode.env.clipboard.readText();
      assert.match(value, /^[a-f0-9]{64}$/);
      return value;
    } finally { await vscode.env.clipboard.writeText(clipboard); }
  }
  async function connect(port, key) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
      headers: { Authorization: `Bearer ${key}`, Origin: 'aircodum://native' },
    });
    sockets.add(socket);
    socket.messages = [];
    socket.on('message', raw => {
      const text = raw.toString();
      socket.messages.push(text.startsWith('data:image/') ? { type: 'screenshot', image: text } : JSON.parse(text));
    });
    await event(socket, 'open');
    await until(() => socket.messages.some(m => m.type === 'server_capabilities'), 'capability handshake');
    return socket;
  }
  async function send(socket, ...messages) {
    const start = socket.messages.length;
    for (const message of messages) socket.send(typeof message === 'string' || Buffer.isBuffer(message) ? message : JSON.stringify(message));
    socket.send(JSON.stringify({ type: 'ping' }));
    await until(() => socket.messages.slice(start).some(m => m.type === 'pong'), 'ordered message delivery');
    assert(!socket.messages.slice(start).some(m => m.type === 'error'), 'Request must succeed');
  }
  async function focus() {
    if (process.platform === 'darwin') {
      const line = execFileSync('ps', ['-Ao', 'pid,command'], { encoding: 'utf8' }).split('\n')
        .find(line => /\/Contents\/MacOS\/(Code|Electron) /.test(line) && line.includes(path.join(root, 'profile')));
      const pid = Number(line?.trim().split(/\s/)[0]);
      assert(Number.isInteger(pid) && pid > 0, 'Locate only this isolated VS Code process');
      execFileSync('osascript', ['-e', `tell application "System Events" to set frontmost of first application process whose unix id is ${pid} to true`]);
    }
    await vscode.window.showTextDocument(document, { preserveFocus: false });
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    await until(() => vscode.window.state.focused, 'owned editor focus');
    await pause(250);
  }
  try {
    await vscode.commands.executeCommand('extension.startAirCodumServer');
    const info = extension.exports.getConnectionInfo();
    assert.equal(info.isRunning, true);
    assert(vscode.window.tabGroups.all.flatMap(g => g.tabs).some(t => t.label === 'AirCodum'));
    const pairing = await token();
    for (const key of [undefined, '0'.repeat(64)]) {
      const rejected = new WebSocket(`ws://127.0.0.1:${info.port}`, key ? { headers: { Authorization: `Bearer ${key}` } } : {});
      sockets.add(rejected);
      const status = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { rejected.terminate(); reject(Error('Authentication rejection timed out')); }, 10000);
        rejected.on('unexpected-response', (_request, response) => {
          clearTimeout(timer); response.resume(); resolve(response.statusCode); rejected.terminate();
        });
        rejected.on('open', () => { clearTimeout(timer); reject(Error('Unauthenticated connection accepted')); });
        rejected.on('error', () => {});
      });
      assert.equal(status, 401);
    }
    checks.push('webview opens; missing and incorrect pairing keys rejected');
    let socket = await connect(info.port, pairing);
    await pause(350);
    assert(!socket.messages.some(m => m.type === 'screen-update'), 'No video before subscription');
    await send(socket,
      { type: 'vnc_quality_update', width: 1280, jpegQuality: 85, fps: 10 },
      { type: 'vnc_quality_update', width: 1280.5, jpegQuality: 85.5, fps: '30' },
      { type: 'vnc_start' });
    await until(() => socket.messages.some(m => m.type === 'screen-update'), 'real Rust frame delivery', 20000);
    const frame = socket.messages.find(m => m.type === 'screen-update');
    const decoded = await Jimp.read(Buffer.from(frame.image, 'base64'));
    assert.equal(decoded.width, 1280);
    assert.deepEqual([decoded.width, decoded.height], [frame.dimensions.width, frame.dimensions.height]);
    await send(socket, { type: 'vnc_stop' });
    await pause(250);
    const stopped = socket.messages.filter(m => m.type === 'screen-update').length;
    await pause(400);
    assert.equal(socket.messages.filter(m => m.type === 'screen-update').length, stopped);
    socket.messages = socket.messages.filter(m => m.type !== 'screen-update');
    checks.push('Rust capture decodes to requested dimensions; stop ends delivery');
    await send(socket, 'get screenshot');
    const screenshot = socket.messages.find(m => m.type === 'screenshot');
    assert(screenshot?.image.startsWith('data:image/png;base64,'));
    const still = await Jimp.read(Buffer.from(screenshot.image.split(',')[1], 'base64'));
    assert.equal(still.width, 800);
    socket.messages = socket.messages.filter(m => m.type !== 'screenshot');
    checks.push('screenshot command returns a decodable 800-pixel PNG through Rust');

    const file = path.join(root, 'workspace/dogfood.txt');
    fs.writeFileSync(file, 'fixture');
    document = await vscode.workspace.openTextDocument(file);
    const select = { type: 'vnc_keyboard_event', key: 'a', modifier: [process.platform === 'darwin' ? 'command' : 'control'] };
    for (const text of ['Hello from my phone', 'Rust 🌍 中文 café e\u0301', 'First line\nSecond line', 'x'.repeat(700)]) {
      await focus();
      assert(vscode.window.state.focused);
      await send(socket, select, { type: 'vnc_type', text });
      await until(() => document.getText() === text, 'native editor text exactly matches sent text');
    }
    checks.push('ASCII, Unicode, combining characters, multiline and 700-character native typing');
    await focus();
    await send(socket, 'Select All');
    await until(() => document.getText(vscode.window.activeTextEditor.selection) === document.getText(), 'VS Code command selection');
    await send(socket, { type: 'vnc_type', text: 'Packaged AirCodum dogfood passed ✅' });
    await until(() => document.getText() === 'Packaged AirCodum dogfood passed ✅', 'native typing after command');
    checks.push('VS Code command followed by native replacement');

    const upload = Buffer.from('Dogfood upload: UTF-8 🌍\n');
    await send(socket, upload);
    const uploadDir = path.join(root, 'workspace/AirCodum');
    assert(fs.readdirSync(uploadDir).some(name => fs.readFileSync(path.join(uploadDir, name)).equals(upload)));
    checks.push('binary file upload lands intact in the isolated workspace without an AI key');
    const closed = event(socket, 'close'); socket.close(); await closed;
    socket = await connect(info.port, pairing);
    await send(socket, { type: 'ping' });
    checks.push('reconnect with existing pairing key');
    const disconnected = event(socket, 'close');
    await vscode.commands.executeCommand('extension.stopAirCodumServer');
    await disconnected;
    await vscode.commands.executeCommand('extension.startAirCodumServer');
    const restarted = extension.exports.getConnectionInfo();
    assert.equal(restarted.port, info.port);
    assert.equal(await token(), pairing);
    socket = await connect(restarted.port, pairing);
    await send(socket, { type: 'vnc_start' });
    await until(() => socket.messages.some(m => m.type === 'screen-update'), 'capture resumes after restart', 20000);
    await send(socket, { type: 'vnc_stop' });
    checks.push('server restart retains endpoint and pairing; capture resumes');
    console.log(JSON.stringify({ journey: 'packaged-desktop', version: extension.packageJSON.version, platform: process.platform, checks, passed: true }));
  } finally {
    for (const socket of sockets) if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
    await vscode.commands.executeCommand('extension.stopAirCodumServer');
    await vscode.env.clipboard.writeText(clipboard);
    try { native.moveMouse(originalPointer.x, originalPointer.y); } catch {}
    if (document) { await document.save(); }
  }
};
