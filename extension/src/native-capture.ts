import { execFile } from 'child_process';
import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import screenshot from 'screenshot-desktop';

const run = promisify(execFile);

// Each capture uses an owner-only directory; cleanup also runs after native errors.
async function withFrameFile<T>(work: (path: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'aircodum-frame-'));
  try { return await work(join(directory, 'frame.jpg')); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

export async function capturePrimaryScreen(): Promise<Buffer> {
  if (process.platform !== 'darwin') return screenshot();
  return withFrameFile(async path => {
    // Capture the main display, matching RobotJS coordinates, without running
    // system_profiler to enumerate displays on every frame.
    await run('/usr/sbin/screencapture', ['-x', '-m', '-t', 'jpg', path], { timeout: 5000 });
    return readFile(path);
  });
}

/** Native macOS encoding keeps JPEG decode/resize work off the JS input loop. */
export async function nativeResizeJpeg(
  input: Buffer, dimensions: { width: number; height: number }, quality: number
): Promise<Buffer | null> {
  if (process.platform !== 'darwin') return null;
  return withFrameFile(async path => {
    await writeFile(path, input, { mode: 0o600, flag: 'wx' });
    await run('/usr/bin/sips', ['--resampleHeightWidth',
      String(Math.round(dimensions.height)), String(Math.round(dimensions.width)),
      '-s', 'formatOptions', String(Math.round(quality)), path], { timeout: 5000 });
    return readFile(path);
  });
}
