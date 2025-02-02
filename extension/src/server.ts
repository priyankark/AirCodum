import * as http from "http";
import WebSocket from "ws";
import * as vscode from "vscode";
import { handleWebSocketConnection } from "./websockets";
import { store } from "./state/store";
import { setServerRunning, setWebSocketServer } from "./state/actions";

export async function startServer(address: string): Promise<void> {
  const { server } = store.getState();

  if (server.isRunning) {
    vscode.window.showInformationMessage("AirCodum server is already running.");
    return;
  }

  const httpServer = http.createServer();
  const wss = new WebSocket.Server({ server: httpServer });

  wss.on("connection", handleWebSocketConnection);

  return new Promise((resolve, reject) => {
    httpServer.listen(server.port, address, () => {
      console.log(`AirCodum server started at http://${address}:${server.port}`);
      vscode.window.showInformationMessage(
        `AirCodum server started at http://localhost:${server.port}`
      );
      setServerRunning(true);
      setWebSocketServer(wss);
      resolve();
    });
    httpServer.on("error", reject);
  });
}

export function stopServer(): void {
  const { websocket, webview } = store.getState();

  if (websocket.wss) {
    websocket.wss.close(() => {
      console.log("WebSocket server closed.");
    });
    setWebSocketServer(null);
  }

  setServerRunning(false);

  if (webview.panel) {
    webview.panel.dispose();
  }

  vscode.window.showInformationMessage("AirCodum server stopped");
}
