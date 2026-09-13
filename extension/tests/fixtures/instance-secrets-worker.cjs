const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === 'vscode') return { window: { showInformationMessage() {} } };
  return originalLoad.call(this, name, ...args);
};
const { initializeSecrets, getPairingToken } = require('../../src/ai/utils.ts');
Module._load = originalLoad;
const pending = new Map();
let sequence = 0;
process.on('message', result => {
  const resolve = pending.get(result.requestId);
  if (resolve) { pending.delete(result.requestId); resolve(result.value); }
});
function request(method, key, value) {
  return new Promise(resolve => {
    const requestId = ++sequence; pending.set(requestId, resolve);
    process.send({ requestId, method, key, value });
  });
}
(async () => {
  await initializeSecrets({
    secrets: { get: key => request('get', key), store: (key, value) => request('store', key, value) },
    globalStorageUri: { fsPath: process.argv[2] },
  }, process.argv[3]);
  process.send({ done: true, token: await getPairingToken(11040) }, () => process.disconnect());
})().catch(error => { process.send({ error: error.message }, () => process.exit(1)); });
