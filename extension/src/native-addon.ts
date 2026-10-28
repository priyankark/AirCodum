import { isAbsolute } from 'path';

export function loadRustAddon<T>(): T {
  const configured = process.env.AIRCODUM_RUSTY_ROBOT_PATH;
  if (configured && !isAbsolute(configured)) throw new Error('AIRCODUM_RUSTY_ROBOT_PATH must be an absolute trusted addon path');
  return (configured ? require(configured) : require('@priyankark/rusty-robot')) as T;
}
