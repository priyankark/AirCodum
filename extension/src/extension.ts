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
import { initializeSecrets, getPairingToken } from "./ai/utils";
import { store } from "./state/store";
import {
  setServerAddress,
  setServerRunning,
} from "./state/actions";
import { startServer, stopServer } from "./server";
import { createWebviewPanel } from "./webview";

export async function activate(context: vscode.ExtensionContext) {
  await initializeSecrets(context);

  const startServerAndWebview = async () => {
    if (store.getState().server.isRunning) {
      vscode.window.showInformationMessage(
        "AirCodum server is already running."
      );
      return;
    }

    const address = vscode.workspace.getConfiguration("aircodum").get<string>("bindAddress", "127.0.0.1");
    await startServer(address, await getPairingToken());
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
    async () => {
      const { webview, server } = store.getState();
      if (webview.panel) {
        webview.panel.reveal();
      } else {
        if (!server.isRunning) {
          await startServerAndWebview();
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

  context.subscriptions.push(vscode.commands.registerCommand("extension.copyAirCodumPairingToken", async () => {
    await vscode.env.clipboard.writeText(await getPairingToken());
    vscode.window.showInformationMessage("Pairing token copied. Paste it into the mobile connection settings.");
  }));

}

export function deactivate() { stopServer(); }
