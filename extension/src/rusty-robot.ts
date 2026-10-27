import { isAbsolute, resolve } from 'path';

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
  if (addon.getPermissions().accessibility === false) throw new Error('Rusty Robot needs Accessibility permission for VS Code');
  const held = new Set<string>();
  return {
    getScreenSize: () => addon.getScreenSize(),
    moveMouse(x, y) { const button = Array.from(held).pop(); if (button) addon.dragMouse(x, y, button); else addon.moveMouse(x, y); },
    mouseToggle(state, button = 'left') {
      addon.mouseToggle(state, button);
      if (state === 'down') held.add(button); else held.delete(button);
    },
    mouseClick: button => addon.mouseClick(button),
    scrollMouse: (x, y) => addon.scrollMouse(x, y),
    keyTap: (key, modifiers) => addon.keyTap(key, modifiers),
    keyToggle: (key, state, modifiers) => addon.keyToggle(key, state, modifiers),
    typeString: text => addon.typeString(text),
    setKeyboardDelay: ms => addon.setKeyboardDelay(ms),
  };
}
export function loadInputBackend(robotjsPath: string): InputBackend {
  const backend = process.env.AIRCODUM_INPUT_BACKEND || 'robotjs';
  if (backend === 'robotjs') return require(robotjsPath) as InputBackend;
  if (backend !== 'rusty-robot') throw new Error(`Unknown AIRCODUM_INPUT_BACKEND: ${backend}`);
  const configured = process.env.AIRCODUM_RUSTY_ROBOT_PATH;
  if (configured && !isAbsolute(configured)) throw new Error('AIRCODUM_RUSTY_ROBOT_PATH must be an absolute trusted addon path');
  return createRustBackend(require(configured || resolve(__dirname, '../native/rusty-robot/aircodum-rusty-robot.node')) as RustAddon);
}
