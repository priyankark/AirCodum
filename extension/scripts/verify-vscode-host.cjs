'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runTests } = require('@vscode/test-electron');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aircodum-packaged-host-'));
  try {
    execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'zipfile', '-e', path.resolve(process.argv[2]), root]);
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace);
    const env = { ...process.env };
    env.AIRCODUM_PACKAGED_DESKTOP = process.argv.includes('--desktop') ? '1' : '';
    env.AIRCODUM_DOGFOOD_ROOT = root;
    fs.mkdirSync(path.join(root, 'profile/User'), { recursive: true });
    fs.writeFileSync(path.join(root, 'profile/User/settings.json'), JSON.stringify({
      'aircodum.bindAddress': '127.0.0.1', 'aircodum.port': 0,
      'editor.autoIndent': 'none', 'editor.autoClosingBrackets': 'never',
      'editor.autoClosingQuotes': 'never', 'editor.quickSuggestions': false,
      'editor.suggestOnTriggerCharacters': false, 'files.autoSave': 'off',
      'workbench.startupEditor': 'none', 'telemetry.telemetryLevel': 'off',
    }));
    for (const key of ['AIRCODUM_INPUT_BACKEND', 'AIRCODUM_MEDIA_BACKEND', 'AIRCODUM_RUSTY_ROBOT_PATH']) env[key] = '';
    // runTests merges environments; empty values are deleted inside the bootstrap.
    const bootstrap = path.join(root, 'host-test.cjs');
    fs.writeFileSync(bootstrap, `for(const key of ${JSON.stringify(['AIRCODUM_INPUT_BACKEND','AIRCODUM_MEDIA_BACKEND','AIRCODUM_RUSTY_ROBOT_PATH'])})delete process.env[key];module.exports=require(${JSON.stringify(path.resolve(__dirname, '../tests/packaged-host.cjs'))});`);
    await runTests({
      ...(process.env.AIRCODUM_TEST_VSCODE ? {vscodeExecutablePath:process.env.AIRCODUM_TEST_VSCODE} : {version:'1.101.0'}),
      extensionDevelopmentPath: path.join(root, 'extension'),
      extensionTestsPath: bootstrap,
      extensionTestsEnv: env,
      launchArgs: [workspace, '--new-window', '--user-data-dir', path.join(root,'profile'), '--extensions-dir', path.join(root,'extensions'), '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--password-store=basic', '--no-sandbox', '--disable-gpu'],
    });
  } finally { fs.rmSync(root, {recursive:true, force:true}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
