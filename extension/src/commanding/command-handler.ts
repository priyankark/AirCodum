import * as vscode from "vscode";
import * as WebSocket from "ws";
import { BuiltInCommands, Commands } from "./commands";
import { RobotJSCommandHandlers } from "./robotjs-handlers";
import { chatWithOpenAI } from "../ai/api";
import { getApiKey } from "../ai/utils";
import { takeAndSendScreenshot } from "./screenshot-handler";
import { store } from "../state/store";

/**
 * Handle a command received from the WebSocket connection.
 * Uses appropriate VS Code APIs and external libraries to execute the command.
 * @param command
 * @param ws
 * @returns
 */
export async function handleCommand(
  command: keyof typeof Commands,
  ws: WebSocket
) {
  console.log("Received command:", command);
  // Execute BuiltInCommands via VS Code API
  if (Object.keys(BuiltInCommands).includes(command)) {
    vscode.commands.executeCommand(
      BuiltInCommands[command as keyof typeof BuiltInCommands]
    );
    return;
  }

  // The commands below are those that involve extracting entities from the command string
  if (command.toLowerCase().startsWith("type ")) {
    const text = command.slice(5);
    if (command.endsWith(" and enter")) {
      RobotJSCommandHandlers.typeAndEnter(text.slice(0, -10));
    } else {
      RobotJSCommandHandlers.type(text);
    }
    return;
  }

  if (command.toLowerCase().startsWith("keytap ")) {
    const key = command.slice(7).trim() as keyof typeof RobotJSCommandHandlers;
    if (RobotJSCommandHandlers[key]) {
      RobotJSCommandHandlers[key]();
    } else {
      console.warn("Unhandled keytap command:", key);
    }
    return;
  }

  if (command.toLowerCase().startsWith("search ")) {
    const query = command.slice(7);
    RobotJSCommandHandlers.search(query);
    return;
  }

  if (command.toLowerCase().startsWith("replace ")) {
    const [query, replacement] = command.slice(8).split(" with ");
    console.log("query", query);
    console.log("replacement", replacement);
    RobotJSCommandHandlers.replace(query, replacement);
    return;
  }

  if (command.toLowerCase().startsWith("go to line")) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const lineNumber = parseInt(command.slice(10));
    if (!isNaN(lineNumber)) {
      const position = new vscode.Position(lineNumber - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
      return;
    }
  }

  if (command.toLowerCase().startsWith("open file")) {
    const file = command.slice(10);
    vscode.workspace.openTextDocument(file).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
    return;
  }
  const panel = store.getState().webview.panel;
  // Handle any custom commands below
  switch (command) {
    case "get screenshot":
      await takeAndSendScreenshot(ws);
      break;
    default:
      console.warn("Unhandled command:", command);
      try {
        const response = await chatWithOpenAI(command, getApiKey() || "");
        panel?.webview.postMessage({
          type: "chatResponse",
          response,
        });
      } catch (error: any) {
        panel?.webview.postMessage({
          type: "error",
          message: "Error chatting with AI",
        });
      }
      break;
  }
}
