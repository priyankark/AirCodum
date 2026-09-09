// Companion extension for a disposable review VM. Uses the published AirCodum
// extension and its normal pairing command; it does not bypass authentication.
const vscode = require('vscode');
const fs = require('node:fs/promises');
const path = require('node:path');

exports.activate = async context => {
  const root = '/home/reviewer/review-workspace';
  const credentials = '/home/reviewer/.local/state/aircodum-review';
  const extension = vscode.extensions.getExtension('priyankark.aircodum-app');
  if (!extension) throw Error('Published AirCodum extension is missing');
  await extension.activate();
  await vscode.commands.executeCommand('extension.startAirCodumServer');
  const clipboard = await vscode.env.clipboard.readText();
  await vscode.commands.executeCommand('extension.copyAirCodumPairingToken');
  const token = await vscode.env.clipboard.readText();
  await vscode.env.clipboard.writeText(clipboard);
  if (!/^[a-f0-9]{64}$/.test(token)) throw Error('Invalid pairing token');
  await fs.mkdir(credentials, { recursive: true, mode: 0o700 });
  const temporary = path.join(credentials, 'connection.json.tmp');
  await fs.writeFile(temporary, JSON.stringify({ token, port: 443, transport: 'wss' }), { mode: 0o600 });
  await fs.rename(temporary, path.join(credentials, 'connection.json'));
  const document = await vscode.workspace.openTextDocument(path.join(root, 'welcome.txt'));
  await vscode.window.showTextDocument(document, { preview: false });
  await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
  context.subscriptions.push(vscode.commands.registerCommand('aircodumReview.resetSample', async () => {
    await fs.copyFile('/opt/aircodum-review/welcome.txt', path.join(root, 'welcome.txt'));
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('workbench.action.files.revert');
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
  }));
};
