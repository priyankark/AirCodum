import * as vscode from "vscode";
import * as WebSocket from "ws";

export interface AppState {
  server: {
    isRunning: boolean;
    address: string | null;
    port: number;
  };
  webview: {
    panel: vscode.WebviewPanel | null;
  };
  websocket: {
    wss: WebSocket.Server | null;
    connections: WebSocket[];
  };
  currentContext: {
    messageType:
      | "text"
      | "image"
      | "file"
      | "command"
      | "chat"
      | "none"
      | "code"
      | "binary";
    message?: string;
    image?: string;
  };
  apiKey: string | null;
}

class Store {
  private state: AppState;
  private listeners: Set<(state: AppState) => void>;

  constructor() {
    this.state = {
      server: {
        isRunning: false,
        address: null,
        port: 11040,
      },
      webview: {
        panel: null,
      },
      websocket: {
        wss: null,
        connections: [],
      },
      currentContext: {
        messageType: "none",
      },
      apiKey: null,
    };
    this.listeners = new Set();
  }

  getState(): AppState {
    return { ...this.state };
  }

  setState(newState: Partial<AppState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  subscribe(listener: (state: AppState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const store = new Store();
