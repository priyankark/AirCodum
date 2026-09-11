import * as vscode from "vscode";
import { getApiKey, getPairingToken, saveApiKey } from "./ai/utils";
import { setWebviewPanel } from "./state/actions";
import { handleChat } from "./ai/api";

import { getWebviewContent } from "./webview-content";
import { showConnectionLog } from "./connection-log";
import { store } from "./state/store";
import * as QRCode from "qrcode";
import { connectionDetails, pairingCode } from "./connection";

export function createWebviewPanel(
  context: vscode.ExtensionContext
) {
  const panel = vscode.window.createWebviewPanel(
    "AirCodum",
    "AirCodum",
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      localResourceRoots: [],
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getWebviewContent();


  const sendConnection = () => {
    const server = store.getState().server;
    const configured = vscode.workspace.getConfiguration("aircodum").get<string>("bindAddress", "127.0.0.1");
    panel.webview.postMessage({ type: "connection", clients: store.getState().websocket.connections.filter(socket => socket.readyState === 1).length, mac: process.platform === "darwin", ...connectionDetails(server, configured) });
  };
  const unsubscribe = store.subscribe(sendConnection);
  const configSubscription = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration("aircodum.bindAddress")) sendConnection();
  });

  panel.onDidDispose(
    () => {
      unsubscribe();
      configSubscription.dispose();
      setWebviewPanel(null);
    },
    null,
    context.subscriptions
  );

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (!message || typeof message.command !== "string") return;
      try {
      switch (message.command) {
        case "addToCurrentFile":
          addToCurrentFile(message.text);
          break;
        case "toggleKeepAwake":
          await vscode.commands.executeCommand('extension.toggleAirCodumKeepAwake');
          break;
        case "showConnectionLog":
          showConnectionLog();
          break;
        case "connection":
          sendConnection();
          panel.webview.postMessage({ type: "apiKeyStatus", saved: Boolean(getApiKey()) });
          await vscode.commands.executeCommand('extension.aircodumPowerStatus');
          break;
        case "showPairingQr": {
          try {
            const server = store.getState().server;
            const payload = pairingCode(server, await getPairingToken());
            const dataUrl = await QRCode.toDataURL(payload, { width: 640, margin: 4, errorCorrectionLevel: 'M' });
            const current = store.getState().server;
            if (current.isRunning && current.address === server.address && current.port === server.port) {
              panel.webview.postMessage({ type: "pairingQr", dataUrl });
            }
          } catch (error) {
            panel.webview.postMessage({ type: "error", message: error instanceof Error ? error.message : "Unable to create pairing QR code." });
          }
          break;
        }
        case "configureConnection":
          await vscode.commands.executeCommand("extension.configureAirCodumConnection");
          break;
        case "copyPairingToken":
          await vscode.commands.executeCommand("extension.copyAirCodumPairingToken");
          panel.webview.postMessage({ type: "pairingKeyCopied" });
          break;
        case "startServer":
          await vscode.commands.executeCommand("extension.startAirCodumServer");
          break;
        case "stopServer":
          await vscode.commands.executeCommand("extension.stopAirCodumServer");
          break;
        case "saveApiKey":
          await saveApiKey(message.key);
          panel.webview.postMessage({ type: "apiKeyStatus", saved: Boolean(getApiKey()) });
          break;
        case "chat":
          if (typeof message.prompt === "string" && message.prompt.length <= 4096) await handleChat(message.prompt, getApiKey());
          break;
        case "showInfo":
          vscode.window.showInformationMessage(message.message);
          break;
      }
      } catch (error) {
        panel.webview.postMessage({ type: "error", message: error instanceof Error ? error.message : "Unable to complete this action." });
      }
    },
    undefined,
    context.subscriptions
  );
  // Set the panel in the store
  setWebviewPanel(panel);
}

function addToCurrentFile(text: string) {
  if (typeof text !== "string" || text.trim() === "") {
    vscode.window.showErrorMessage("Invalid text input.");
    return;
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, text);
    });
  }
}
