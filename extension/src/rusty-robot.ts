import { loadRustAddon } from './native-addon';

export interface InputBackend {
  getScreenSize(): { width: number; height: number };
  moveMouse(x: number, y: number): void;
  mouseToggle(state: string, button?: string): void;
  mouseClick(button?: string): void;
  scrollMouse(x: number, y: number): void;
  keyTap(key: string, modifiers?: string[]): void;
  keyToggle(key: string, state: string, modifiers?: string[]): void;
  typeString(text: string): void;
  setKeyboardDelay(ms: number): void;
}
interface RustAddon extends InputBackend {
  dragMouse(x: number, y: number, button: string): void;
  getPermissions(): { accessibility?: boolean | null };
}
export function createRustBackend(addon: RustAddon): InputBackend {
  for (const method of ['getScreenSize', 'moveMouse', 'dragMouse', 'mouseToggle',
    'mouseClick', 'scrollMouse', 'keyTap', 'keyToggle', 'typeString', 'setKeyboardDelay', 'getPermissions'] as const) {
    if (typeof addon?.[method] !== 'function') throw new Error(`Rusty Robot addon is missing ${method}`);
  }
  const ensureInputPermission = () => {
    if (addon.getPermissions().accessibility === false) throw new Error('Grant Accessibility permission to VS Code in System Settings → Privacy & Security → Accessibility');
  };
  const held = new Set<string>();
  return {
    getScreenSize: () => addon.getScreenSize(),
    moveMouse(x, y) { ensureInputPermission(); const button = Array.from(held).pop(); if (button) addon.dragMouse(x, y, button); else addon.moveMouse(x, y); },
    mouseToggle(state, button = 'left') {
      ensureInputPermission();
      addon.mouseToggle(state, button);
      if (state === 'down') held.add(button); else held.delete(button);
    },
    mouseClick: (button) => { ensureInputPermission(); addon.mouseClick(button); },
    scrollMouse: (x, y) => { ensureInputPermission(); addon.scrollMouse(x, y); },
    keyTap: (key, modifiers) => { ensureInputPermission(); addon.keyTap(key, modifiers); },
    keyToggle: (key, state, modifiers) => { ensureInputPermission(); addon.keyToggle(key, state, modifiers); },
    typeString: (text) => { ensureInputPermission(); addon.typeString(text); },
    setKeyboardDelay: ms => addon.setKeyboardDelay(ms),
  };
}
export function loadInputBackend(robotjsPath: string): InputBackend {
  const backend = process.env.AIRCODUM_INPUT_BACKEND || 'rusty-robot';
  if (backend === 'robotjs') return require(robotjsPath) as InputBackend;
  if (backend !== 'rusty-robot') throw new Error(`Unknown AIRCODUM_INPUT_BACKEND: ${backend}`);
  return createRustBackend(loadRustAddon<RustAddon>());
}
