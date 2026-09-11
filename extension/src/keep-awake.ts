import { ChildProcess, spawn } from 'child_process';

/** Process-scoped macOS assertions; never changes global power-management preferences. */
export class KeepAwake {
  private child: ChildProcess | undefined;
  constructor(private changed: () => void, private failed: (message: string) => void) {}
  get active(): boolean { return !!this.child?.pid; }
  update(enabled: boolean, running: boolean): void {
    if (!enabled || !running || process.platform !== 'darwin') { this.stop(); return; }
    if (this.child) return;
    const child = spawn('/usr/bin/caffeinate', ['-is', '-w', String(process.pid)], { stdio: 'ignore' });
    this.child = child;
    child.once('spawn', this.changed);
    child.once('error', () => {
      if (this.child !== child) return;
      this.child = undefined; this.changed();
      this.failed('AirCodum could not enable Keep Mac awake. Check your Mac’s power settings.');
    });
    child.once('exit', () => { if (this.child === child) { this.child = undefined; this.changed(); } });
  }
  stop(): void {
    const child = this.child; this.child = undefined;
    child?.kill();
    if (child) this.changed();
  }
}
