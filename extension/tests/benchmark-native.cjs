// Loaded by the actual VS Code development extension host. No native input is mocked.
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { WebSocket } = require('ws');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 2000) {
  const end = performance.now() + timeout;
  do { if (check()) return true; await pause(2); } while (performance.now() < end);
  return false;
}
exports.run = async () => {
  const directory = process.env.AIRCODUM_BENCHMARK_DIR;
  assert(directory, 'Use the benchmark launcher with an isolated workspace/profile');
  const extension = vscode.extensions.getExtension('priyankark.aircodum-app');
  assert(extension); await extension.activate();
  let socket;
  const clipboard = await vscode.env.clipboard.readText();
  try {
    await vscode.commands.executeCommand('extension.startAirCodumServer');
    await vscode.commands.executeCommand('extension.copyAirCodumPairingToken');
    const token = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText(clipboard);
    assert.match(token, /^[a-f0-9]{64}$/);
    const info = extension.exports.getConnectionInfo();
    socket = new WebSocket(`ws://127.0.0.1:${info.port}`, { headers: { Authorization: `Bearer ${token}`, Origin: 'aircodum://native' } });
    const messages = [];
    socket.on('message', raw => { const value = JSON.parse(raw); if (value.type !== 'screen-update' || !messages.some(m => m.type === 'screen-update')) messages.push(value); });
    await once(socket, 'open');
    assert(await until(() => messages.some(m => m.type === 'server_capabilities')));
    const send = async values => {
      const marker = messages.length;
      for (const value of values) socket.send(typeof value === 'string' ? value : JSON.stringify(value));
      socket.send(JSON.stringify({ type: 'ping' }));
      assert(await until(() => messages.slice(marker).some(m => m.type === 'pong'), 10000), 'Authenticated socket must drain');
      assert(!messages.slice(marker).some(m => m.type === 'error'), 'Extension rejected an input command');
    };
    // Validate the real, unmocked capture pipeline once, outside input timing.
    await send([{ type: 'vnc_start' }]);
    assert(await until(() => messages.some(m => m.type === 'screen-update'), 15000), 'Native screen capture must deliver');
    const frame = messages.find(m => m.type === 'screen-update');
    assert.equal(Buffer.from(frame.image, 'base64').subarray(0, 2).toString('hex'), 'ffd8');
    await send([{ type: 'vnc_stop' }]);
    const captured = { width: frame.dimensions.width, height: frame.dimensions.height, jpeg: true };
    messages.length = 0; // Discard screen contents; only dimensions/format are recorded.
    const video = process.env.AIRCODUM_BENCHMARK_VIDEO === '1' ? await require('./frame-benchmark/frames.cjs').run(socket, require('jimp').Jimp) : null;
    const file = path.join(directory, 'workspace', 'benchmark.txt');
    fs.writeFileSync(file, '');
    const document = await vscode.workspace.openTextDocument(file);
    const focus = async () => {
      if (process.platform === 'darwin') {
        const line = execFileSync('ps', ['-Ao', 'pid,command'], { encoding: 'utf8' }).split('\n')
          .find(line => line.includes('/Contents/MacOS/Code --new-window') && line.includes(`--user-data-dir ${directory}/profile`));
        const pid = Number(line?.trim().split(/\s/)[0]); assert(Number.isInteger(pid) && pid > 0);
        execFileSync('osascript', ['-e', `tell application "System Events" to set frontmost of first application process whose unix id is ${pid} to true`]);
      }
      await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
      await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      assert(await until(() => vscode.window.state.focused, 10000));
      await pause(150);
    };
    await focus();
    const modifier = process.platform === 'darwin' ? 'command' : 'control';
    const tap = key => ({ type: 'vnc_keyboard_event', key });
    const select = { ...tap('a'), modifier: [modifier] };
    const type = text => ({ type: 'vnc_type', text });
    const cases = [
      { name: 'type_ascii_31', initial: '', messages: [type('Agentum benchmark: hello world.')], expected: 'Agentum benchmark: hello world.' },
      { name: 'type_unicode', initial: '', messages: [type('Rust 🌍 中文 café')], expected: 'Rust 🌍 中文 café' },
      { name: 'type_multiline', initial: '', messages: [type('First line\nSecond line')], expected: 'First line\nSecond line' },
      { name: 'shortcut_replace', initial: 'replace me', messages: [select, type('Replacement complete')], expected: 'Replacement complete' },
      { name: 'command_type_and_enter', initial: '', messages: ['type command text and enter'], expected: 'command text\n' },
      { name: 'native_select_delete', initial: 'selection target', messages: [select, tap('backspace')], expected: '' },
    ];
    const results = [];
    for (let repetition = -1; repetition < 5; repetition++) {
      const rotated = [...cases.slice((repetition + 1) % cases.length), ...cases.slice(0, (repetition + 1) % cases.length)];
      for (const spec of rotated) {
        if (!vscode.window.state.focused || vscode.window.activeTextEditor?.document !== document) await focus();
        assert(vscode.window.state.focused && vscode.window.activeTextEditor?.document === document, 'Owned VS Code editor must retain focus');
        // Editor API setup is outside timing. Only the actual socket/native path
        // changes the document between the start timestamp and observation.
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), spec.initial);
        assert(await vscode.workspace.applyEdit(edit));
        const editor = vscode.window.activeTextEditor, end = document.positionAt(spec.initial.length);
        editor.selection = new vscode.Selection(end, end);
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        await pause(150);
        const started = performance.now(); await send(spec.messages); const dispatched = performance.now();
        const passed = await until(() => document.getText() === spec.expected);
        const completed = performance.now();
        if (repetition >= 0) results.push({ case: spec.name, repetition, dispatch_ms: dispatched - started,
          delivered_ms: passed ? completed - started : null, passed, observed_text: document.getText() });
      }
    }
    fs.writeFileSync(path.join(directory, 'result.json'), JSON.stringify({ backend: process.env.AIRCODUM_INPUT_BACKEND || 'robotjs',
      platform: process.platform, node: process.version, vscode: vscode.version, robotjs: require('@hurdlegroup/robotjs/package.json').version,
      repetitions: 5, warmups: 1, observation_poll_ms: 2, captured, video,
      transport: 'Real VS Code extension host, authenticated loopback socket, native input, actual editor document; no mocks', results }, null, 2));
    console.log(`Native benchmark completed: ${results.filter(r=>r.passed).length}/${results.length} correct`);
    await document.save();
  } finally {
    socket?.terminate();
    await vscode.commands.executeCommand('extension.stopAirCodumServer');
    await vscode.env.clipboard.writeText(clipboard);
  }
};
