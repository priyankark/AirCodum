// Shared Rust capture/resize/encode workers. Input and media can be selected independently.
import { loadRustAddon } from './native-addon';
export interface RustFrame {
  data?: Buffer | null; width: number; height: number;
  sourceWidth: number; sourceHeight: number; fingerprint: string; changed: boolean;
  captureMs: number; convertMs: number; resizeMs: number; hashMs: number; encodeMs: number;
}
interface MediaAddon {
  captureFrame(width?: number | null, quality?: number | null, previous?: string | null, force?: boolean, format?: string): Promise<RustFrame>;
  resizeImage(input: Buffer, width: number, height?: number | null, quality?: number, format?: string): Promise<RustFrame>;
}
let cached: MediaAddon | undefined;
export function useRustMedia(): boolean {
  const backend = process.env.AIRCODUM_MEDIA_BACKEND || process.env.AIRCODUM_INPUT_BACKEND || 'rusty-robot';
  if (backend !== 'robotjs' && backend !== 'rusty-robot') throw new Error(`Unknown AIRCODUM_MEDIA_BACKEND: ${backend}`);
  return backend === 'rusty-robot';
}
export function loadRustMedia(): MediaAddon {
  if (cached) return cached;
  const addon = loadRustAddon<MediaAddon>();
  for (const method of ['captureFrame', 'resizeImage'] as const) {
    if (typeof addon?.[method] !== 'function') throw new Error(`Rusty Robot addon is missing ${method}; rebuild the shared addon`);
  }
  cached = addon; return addon;
}
