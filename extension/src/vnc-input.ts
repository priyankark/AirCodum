/** RobotJS exposes different native units on each desktop platform. */
export function nativeScrollDelta(ticks: number, platform: string = process.platform): number {
  return ticks * (platform === 'win32' ? 120 : platform === 'darwin' ? 12 : 1);
}
