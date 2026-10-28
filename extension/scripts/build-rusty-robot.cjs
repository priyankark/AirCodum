#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdirSync, existsSync } = require('node:fs');
const { resolve, join, isAbsolute } = require('node:path');
const root = resolve(__dirname, '..'), directory = join(root, 'native/rusty-robot');
const pin = require('../native/rusty-robot/source.json');
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const configured = process.env.RUSTY_ROBOT_SOURCE;
if (configured && !isAbsolute(configured)) throw new Error('RUSTY_ROBOT_SOURCE must be an absolute trusted checkout');
const source = configured || join(directory, 'source');
if (!configured) {
  mkdirSync(source, { recursive: true });
  if (!existsSync(join(source, '.git'))) {
    run('git', ['init'], source); run('git', ['remote', 'add', 'origin', pin.repository], source);
  }
  run('git', ['fetch', '--depth', '1', pin.repository, pin.revision], source);
  run('git', ['checkout', '--detach', pin.revision], source);
}
run(process.execPath, [join(source, 'scripts/build-node.cjs')], source);
copyFileSync(join(source, 'target/rusty-robot.node'), join(directory, 'aircodum-rusty-robot.node'));
console.log('Built shared Rust input/media addon for this host');
