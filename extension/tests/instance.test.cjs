const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === 'vscode') return { window: { showInformationMessage() {} } };
  return originalLoad.call(this, name, ...args);
};
const instance = require('../src/instance.ts');
const secrets = require('../src/ai/utils.ts');
Module._load = originalLoad;
function state(values = {}) {
  return { get: key => values[key], update: async (key, value) => { values[key] = value; } };
}

test('workspace identity, name and selected port survive restart and isolate duplicate window ports', async () => {
  const context = { workspaceState: state() };
  const id = await instance.initializeInstance(context, 'API');
  const first = instance.getInstance(11040);
  assert.match(first.name, /API$/);
  await instance.renameInstance('  My laptop · API  ');
  await instance.rememberPort(11043);
  assert.equal(await instance.initializeInstance(context, 'API'), id);
  assert.equal(instance.getInstance(11040).id, first.id);
  assert.equal(instance.getInstance(11040).name, 'My laptop · API');
  assert.equal(instance.preferredPort(), 11043);
  assert.notEqual(instance.getInstance(11041).id, first.id);
  assert.equal(instance.getInstance().sharedDesktop, true);
  const token = 'a'.repeat(64);
  assert.notEqual(instance.tokenForPort(token, 11040), token, 'the private root is never exposed as a listener token');
  assert.notEqual(instance.tokenForPort(token, 11041), token);
  assert.notEqual(instance.tokenForPort(token, 11041), instance.tokenForPort(token, 11042));
  await instance.initializeInstance({ workspaceState: state() }, 'API');
  assert.notEqual(instance.getInstance(11040).id, first.id);
  assert.notEqual(instance.tokenForPort(token, 11041), instance.tokenForPort(token, 11040));
  for (const port of [-1, 1, 1023, 65536, NaN, 11040.5, '11040']) assert.equal(instance.validPort(port), false);
  for (const port of [1024, 11040, 65535]) assert.equal(instance.validPort(port), true);
  await assert.rejects(instance.renameInstance(' \n '));
});

test('legacy token migrates once; new workspaces have stable separate secure credentials', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aircodum-secrets-'));
  const values = new Map([['aircodum.pairingToken', 'a'.repeat(64)]]);
  const context = {
    secrets: { get: async key => values.get(key), store: async (key, value) => values.set(key, value) },
    globalStorageUri: { fsPath: directory },
  };
  try {
    await secrets.initializeSecrets(context, 'existing-workspace');
    assert.equal(await secrets.getPairingToken(11040), 'a'.repeat(64));
    assert.notEqual(values.get('aircodum.pairingRoot'), 'a'.repeat(64), 'migration creates an independent private root');
    const alternate = await secrets.getPairingToken(11041);
    assert.notEqual(alternate, instance.tokenForPort('a'.repeat(64), 11041, 'existing-workspace'), 'knowing the legacy token cannot derive another instance key');
    await secrets.initializeSecrets(context, 'second-workspace');
    const second = await secrets.getPairingToken(11040);
    assert.notEqual(second, 'a'.repeat(64));
    assert.match(second, /^[a-f0-9]{64}$/);
    await secrets.initializeSecrets(context, 'second-workspace');
    assert.equal(await secrets.getPairingToken(11040), second);
    await secrets.initializeSecrets(context, 'existing-workspace');
    assert.equal(await secrets.getPairingToken(11040), 'a'.repeat(64));
    assert.deepEqual(await fs.readdir(directory), ['legacy-pairing-owner']);
    assert.equal(await fs.readFile(path.join(directory, 'legacy-pairing-owner'), 'utf8'), 'existing-workspace');
    await assert.rejects(secrets.initializeSecrets({ ...context, secrets: { ...context.secrets, store: async () => { throw new Error('storage unavailable'); } } }, 'third-workspace'), /storage unavailable/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('simultaneous new workspace activation grants the legacy key to only one owner', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aircodum-secrets-race-'));
  const values = new Map([['aircodum.pairingToken', 'b'.repeat(64)]]);
  const context = {
    secrets: { get: async key => values.get(key), store: async (key, value) => values.set(key, value) },
    globalStorageUri: { fsPath: directory },
  };
  try {
    await Promise.all(Array.from({ length: 12 }, (_, i) => secrets.initializeSecrets(context, `workspace-${i}`)));
    const workspaceTokens = [...values].filter(([key]) => key.startsWith('aircodum.pairingToken.')).map(([, value]) => value);
    assert.equal(new Set(workspaceTokens).size, 12);
    assert.equal(workspaceTokens.filter(value => value === 'b'.repeat(64)).length, 1);
    assert.deepEqual(await fs.readdir(directory), ['legacy-pairing-owner']);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('concurrent workspace opens compute the same durable ID without racing memento writes', async () => {
  const windows = Array.from({ length: 8 }, () => ({ workspaceState: state() }));
  const ids = await Promise.all(windows.map(context => instance.initializeInstance(context, 'API', 'machine:file:///Users/test/api')));
  assert.equal(new Set(ids).size, 1);
  const other = await instance.initializeInstance({ workspaceState: state() }, 'API', 'machine:file:///Users/test/web');
  assert.notEqual(other, ids[0]);
});

test('fresh simultaneous activations create one root secret and one stable key per workspace', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aircodum-secrets-fresh-'));
  const values = new Map(), writes = [];
  const context = {
    secrets: { get: async key => values.get(key), store: async (key, value) => { writes.push(key); values.set(key, value); } },
    globalStorageUri: { fsPath: directory },
  };
  try {
    await Promise.all(Array.from({ length: 8 }, (_, i) => secrets.initializeSecrets(context, i % 2 ? 'same-workspace' : 'another-workspace')));
    for (const key of ['aircodum.pairingRoot', 'aircodum.pairingToken.same-workspace', 'aircodum.pairingToken.another-workspace']) {
      assert.equal(writes.filter(written => written === key).length, 1, `${key} initialized once`);
    }
    assert.notEqual(values.get('aircodum.pairingToken.same-workspace'), values.get('aircodum.pairingToken.another-workspace'));
    assert.deepEqual(await fs.readdir(directory), []);
    const stored = values.get('aircodum.pairingToken.same-workspace');
    await secrets.initializeSecrets(context, 'same-workspace');
    assert.equal(await secrets.getPairingToken(11040), stored);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('separate extension host processes cannot race initial root or workspace credentials', async () => {
  const { fork } = require('node:child_process');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aircodum-secrets-processes-'));
  const values = new Map(), writes = [], children = [];
  try {
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => new Promise((resolve, reject) => {
      const child = fork(path.join(__dirname, 'fixtures/instance-secrets-worker.cjs'), [directory, `workspace-${i % 3}`], {
        execArgv: ['--require', path.join(__dirname, 'register.cjs')], stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });
      children.push(child);
      let result, stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('message', message => {
        if (message.done) { result = { workspace: i % 3, token: message.token }; return; }
        if (message.error) { reject(new Error(message.error)); return; }
        // SecretStorage is served by the parent, as VS Code's shared secret
        // service is outside each extension host. Delays widen initialization races.
        setTimeout(() => {
          if (!child.connected) return;
          if (message.method === 'store') { writes.push(message.key); values.set(message.key, message.value); }
          child.send({ requestId: message.requestId, value: message.method === 'get' ? values.get(message.key) : undefined });
        }, 10);
      });
      child.on('exit', code => code === 0 && result ? resolve(result) : reject(new Error(`Credential worker failed: ${code} ${stderr}`)));
    })));
    assert.equal(writes.filter(key => key === 'aircodum.pairingRoot').length, 1);
    for (let i = 0; i < 3; i++) {
      assert.equal(writes.filter(key => key === `aircodum.pairingToken.workspace-${i}`).length, 1);
      assert.equal(new Set(results.filter(result => result.workspace === i).map(result => result.token)).size, 1);
    }
    assert.equal(new Set(results.map(result => result.token)).size, 3);
    assert.deepEqual(await fs.readdir(directory), [], 'no credentials are written to disk');
  } finally {
    for (const child of children) if (child.exitCode === null) child.kill();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
