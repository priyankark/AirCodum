import * as vscode from "vscode";
import WebSocket from "ws";
import { store, AppState } from "./store";

export function setServerRunning(isRunning: boolean) {
  store.setState({
    server: {
      ...store.getState().server,
      isRunning,
    },
  });
}

export function setServerAddress(address: string) {
  store.setState({
    server: {
      ...store.getState().server,
      address,
    },
  });
}

export function setWebviewPanel(panel: vscode.WebviewPanel | null) {
  store.setState({
    webview: {
      panel,
    },
  });
}

export function setWebSocketServer(wss: WebSocket.Server | null) {
  store.setState({
    websocket: {
      ...store.getState().websocket,
      wss,
    },
  });
}

export function addWebSocketConnection(connection: WebSocket) {
  const currentConnections = store.getState().websocket.connections;
  store.setState({
    websocket: {
      ...store.getState().websocket,
      connections: [...currentConnections, connection],
    },
  });
}

export function removeWebSocketConnection(connection: WebSocket) {
  const currentConnections = store.getState().websocket.connections;
  store.setState({
    websocket: {
      ...store.getState().websocket,
      connections: currentConnections.filter((conn) => conn !== connection),
    },
  });
}

export function setCurrentContext(context: AppState["currentContext"]) {
  store.setState({
    currentContext: context,
  });
}

export function setApiKey(apiKey: string | null) {
  store.setState({
    apiKey,
  });
}
