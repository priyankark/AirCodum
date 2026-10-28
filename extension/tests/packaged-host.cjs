'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
exports.run = async () => {
  const vscode = require('vscode');
  for (const name of ['AIRCODUM_INPUT_BACKEND', 'AIRCODUM_MEDIA_BACKEND', 'AIRCODUM_RUSTY_ROBOT_PATH']) {
    assert.equal(process.env[name], undefined, 'Test the unconfigured release defaults');
  }
  const extension = vscode.extensions.getExtension('priyankark.aircodum-app');
  assert.ok(extension, 'Packaged AirCodum must be discoverable');
  await extension.activate();
  assert.equal(extension.isActive, true);
  assert.equal(extension.packageJSON.version, '0.5.0');
  await require('../scripts/verify-native.cjs')(path.join(extension.extensionPath, 'dist/rusty-robot'));
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('extension.startAirCodumServer'));
  assert.ok(commands.includes('extension.stopAirCodumServer'));
  if (process.env.AIRCODUM_PACKAGED_DESKTOP === '1') {
    await require('./packaged-desktop.cjs').run(extension);
  }
  console.log(`Packaged AirCodum activates in VS Code ${vscode.version}, Node ${process.versions.node}`);
};
