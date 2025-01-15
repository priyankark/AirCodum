import * as path from "path";
import * as vscode from "vscode";
import os from "os";

// Dynamically load the correct native module based on the platform
let robotjsPath: string;
if (process.platform === "darwin") {
  robotjsPath = path.join(
    __dirname,
    "darwin-x64+arm64",
    "@hurdlegroup+robotjs.node"
  );
} else if (process.platform === "linux") {
  robotjsPath = path.join(__dirname, "linux-x64", "@hurdlegroup+robotjs.node");
} else if (process.platform === "win32") {
  if (os.arch() === "x64") {
    robotjsPath = path.join(
      __dirname,
      "win32-x64",
      "@hurdlegroup+robotjs.node"
    );
  } else {
    robotjsPath = path.join(
      __dirname,
      "win32-ia32",
      "@hurdlegroup+robotjs.node"
    );
  }
} else {
  throw new Error("Unsupported platform");
}

// Load the native module
const robot = require(robotjsPath);

// Type definition for the robotjs module
interface RobotJS {
  typeString(text: string): void;
  keyTap(key: string, modifiers?: string[]): void;
  setKeyboardDelay(ms: number): void;
  moveMouse(x: number, y: number): void;
  mouseClick(button?: string): void;
  mouseToggle(down: string, button?: string): void;
  scrollMouse(x: number, y: number): void;
  getScreenSize(): { width: number; height: number };
}

// Assert that the loaded module matches the expected interface
export const typedRobot = robot as RobotJS;

/**
 * Commands that involve Desktop automation not possible with VS Code APIs.
 * These commands are handled by a fork of the `robotjs` library.
 */
export const RobotJSCommandHandlers: Record<
  string,
  (...args: string[]) => void
> = {
  type: (text: string) => {
    typedRobot.typeString(text);
  },
  typeAndEnter: (text: string) => {
    typedRobot.typeString(text);
    typedRobot.keyTap("enter");
  },
  enter: () => typedRobot.keyTap("enter"),
  tab: () => typedRobot.keyTap("tab"),
  escape: () => typedRobot.keyTap("escape"),
  backspace: () => typedRobot.keyTap("backspace"),
  delete: () => typedRobot.keyTap("delete"),
  space: () => typedRobot.keyTap("space"),
  up: () => typedRobot.keyTap("up"),
  down: () => typedRobot.keyTap("down"),
  left: () => typedRobot.keyTap("left"),
  right: () => typedRobot.keyTap("right"),
  shift: () => typedRobot.keyTap("shift"),
  search: (query: string) => {
    // Open the search panel
    if (process.platform === "darwin") {
      typedRobot.keyTap("f", ["command", "shift"]);
    } else {
      typedRobot.keyTap("f", ["control", "shift"]);
    }

    // Wait briefly to ensure the panel is open
    typedRobot.setKeyboardDelay(200);

    // Type the search query
    typedRobot.typeString(query);
  },
  replace: (query: string, replacement: string) => {
    // Open the replace panel
    if (process.platform === "darwin") {
      typedRobot.keyTap("h", ["command", "shift"]);
    } else {
      typedRobot.keyTap("h", ["control", "shift"]);
    }

    // Wait briefly to ensure the panel is open
    typedRobot.setKeyboardDelay(200);

    // Type the search query
    typedRobot.typeString(query);

    // Move focus to the replace field
    typedRobot.keyTap("tab");

    // Type the replacement text
    typedRobot.typeString(replacement);

    // Optionally, execute the replace by pressing Enter
    typedRobot.keyTap("enter");
  },
};
