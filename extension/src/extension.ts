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
import { startServer, stopServer } from "./server";
import { createWebviewPanel } from "./webview";
import { networkInterfaces } from "os";
import { tailscaleAddresses } from "./connection";

export async function activate(context: vscode.ExtensionContext) {
  await initializeSecrets(context);

  const showPanel = () => {
    const { webview } = store.getState();
    if (webview.panel) webview.panel.reveal();
    else createWebviewPanel(context);
  };

  const startServerAndWebview = async () => {
    showPanel();
    if (store.getState().server.isRunning) return;
    try {
      const address = vscode.workspace.getConfiguration("aircodum").get<string>("bindAddress", "127.0.0.1");
      await startServer(address, await getPairingToken());
    } catch (error) {
      vscode.window.showErrorMessage(`AirCodum could not start: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  context.subscriptions.push(vscode.commands.registerCommand("extension.configureAirCodumConnection", async () => {
    const addresses = tailscaleAddresses(networkInterfaces());
    const choices = addresses.map(address => ({ label: "Tailscale", description: address, address }));
    choices.push({ label: "Localhost", description: "This Mac only, or a local TLS proxy", address: "127.0.0.1" });
    const choice = await vscode.window.showQuickPick(choices, {
      title: "AirCodum connection",
      placeHolder: addresses.length ? "Choose the address your phone will connect to" : "No Tailscale address found. Connect Tailscale on this Mac, then try again.",
    });
    if (!choice) return;
    try {
      await vscode.workspace.getConfiguration("aircodum").update("bindAddress", choice.address, vscode.ConfigurationTarget.Global);
      stopServer();
      await startServerAndWebview();
    } catch (error) {
      vscode.window.showErrorMessage(`AirCodum connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));

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
          createWebviewPanel(context);
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
