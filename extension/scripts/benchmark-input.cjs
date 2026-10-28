#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');
const os = require('node:os');
const root = resolve(__dirname, '..');
const code = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
if (!existsSync(code)) throw new Error('Install VS Code at the standard macOS location');
const output = join(root, process.env.AIRCODUM_BENCHMARK_OUTPUT || 'benchmarks/2026-10-27-composed'); mkdirSync(output, { recursive: true });
const rounds = Number(process.env.AIRCODUM_BENCHMARK_ROUNDS || 3);
const backends = process.env.AIRCODUM_BENCHMARK_BACKENDS?.split(',') || ['robotjs', 'rusty-robot'];
const runs = [];
for (let round = 1; round <= rounds; round++) {
  for (const backend of round % 2 ? backends : [...backends].reverse()) {
    const directory = mkdtempSync(join(os.tmpdir(), 'aircodum-rusty-bench-'));
    try {
      mkdirSync(join(directory, 'workspace/.vscode'), { recursive: true });
      mkdirSync(join(directory, 'profile/User'), { recursive: true });
      writeFileSync(join(directory, 'profile/User/settings.json'), JSON.stringify({ 'aircodum.port': 0, 'aircodum.bindAddress': '127.0.0.1',
        'editor.autoIndent': 'none', 'editor.autoClosingBrackets': 'never', 'editor.autoClosingQuotes': 'never',
        'editor.quickSuggestions': false, 'editor.suggestOnTriggerCharacters': false, 'files.autoSave': 'off',
        'security.workspace.trust.enabled': false, 'workbench.startupEditor': 'none', 'telemetry.telemetryLevel': 'off' }));
      const result = spawnSync(code, ['--new-window', '--user-data-dir', join(directory, 'profile'), '--extensions-dir', join(directory, 'extensions'),
        '--disable-extensions', '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
        `--extensionDevelopmentPath=${root}`, `--extensionTestsPath=${join(root, 'tests/benchmark-native.cjs')}`, join(directory, 'workspace')], {
        cwd: root, env: { ...process.env, AIRCODUM_INPUT_BACKEND: backend, AIRCODUM_MEDIA_BACKEND: backend, AIRCODUM_CAPTURE_ADAPTIVE: '0', AIRCODUM_BENCHMARK_VIDEO: '1', AIRCODUM_BENCHMARK_DIR: directory,
          AIRCODUM_RUSTY_ROBOT_PATH: join(root, 'native/rusty-robot/aircodum-rusty-robot.node') },
        encoding: 'utf8', timeout: 240000,
      });
      // Keep private host logs outside the public raw-data snapshot.
      const logDirectory = join(root, 'benchmark-artifacts'); mkdirSync(logDirectory, { recursive: true });
      writeFileSync(join(logDirectory, `${round}-${backend}.log`), result.stdout + result.stderr);
      if (result.error || result.status !== 0) throw new Error(`${backend} round ${round} failed; see benchmark-artifacts/${round}-${backend}.log: ${result.error || result.status}`);
      const data = JSON.parse(readFileSync(join(directory, 'result.json'), 'utf8'));
      writeFileSync(join(output, `${round}-${backend}.json`), JSON.stringify(data, null, 2)); runs.push({ round, ...data });
      console.log(`Round ${round}: ${backend}, ${data.results.filter(r=>r.passed).length}/30 correct`);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
writeFileSync(join(output, 'raw.json'), JSON.stringify({ measured_at: new Date().toISOString(), platform: os.platform(), release: os.release(), cpu: os.cpus()[0].model,
  aircodum_base_commit: git, harness_note: 'Benchmark harness and integration changes are committed alongside this snapshot', runs }, null, 2));
console.log(output);
