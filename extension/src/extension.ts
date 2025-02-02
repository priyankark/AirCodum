/**
 * AirCodum: Smartphone powered Remote Control for VS Code
 * Copyright (C) 2024 Priyankar Kumar
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as vscode from "vscode";
import { getIPAddress } from "./utils";
import { store } from "./state/store";
import {
  setServerAddress,
  setServerRunning,
  setWebviewPanel,
} from "./state/actions";
import { startServer, stopServer } from "./server";
import { createWebviewPanel } from "./webview";

export function activate(context: vscode.ExtensionContext) {
  console.log("AirCodum Extension is now active!");

  const startServerAndWebview = async () => {
    if (store.getState().server.isRunning) {
      vscode.window.showInformationMessage(
        "AirCodum server is already running."
      );
      return;
    }

    const address = getIPAddress();
    await startServer('0.0.0.0');
    setServerRunning(true);
    setServerAddress(address);
    createWebviewPanel(context, address);
  };

  const startServerCommand = vscode.commands.registerCommand(
    "extension.startAirCodumServer",
    startServerAndWebview
  );

  const openWebViewCommand = vscode.commands.registerCommand(
    "extension.openAirCodumWebview",
    () => {
      const { webview, server } = store.getState();
      if (webview.panel) {
        webview.panel.reveal();
      } else {
        if (!server.isRunning) {
          startServerAndWebview();
        } else {
          createWebviewPanel(context, server.address!);
        }
      }
    }
  );

  const stopServerCommand = vscode.commands.registerCommand(
    "extension.stopAirCodumServer",
    stopServer
  );

  context.subscriptions.push(
    startServerCommand,
    stopServerCommand,
    openWebViewCommand
  );

  // Subscribe to state changes
  const unsubscribe = store.subscribe((state) => {
    console.log("State updated:", state);
    // You can perform actions based on state changes here
  });

  context.subscriptions.push({ dispose: unsubscribe });
}

export function deactivate() {
  const wss = store.getState().websocket.wss;
  const panel = store.getState().webview.panel;
  if (wss) {
    wss.close(() => {
      console.log("WebSocket server closed.");
    });
  }
  if (panel) {
    panel.dispose();
    setWebviewPanel(null);
  }
}
