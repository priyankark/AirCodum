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
import { initializeSecrets, getPairingToken, resolvePairingToken } from "./ai/utils";
import { store } from "./state/store";
import { startServer, stopServer } from "./server";
import { createWebviewPanel } from "./webview";
import { KeepAwake } from "./keep-awake";
import { networkInterfaces } from "os";
import { tailscaleAddresses, localNetworkAddresses } from "./connection";
import { DEFAULT_PORT, getInstance, initializeInstance, preferredPort, rememberPort, renameInstance, validPort } from './instance';
import { initializeConnectionLog } from './connection-log';

export async function activate(context: vscode.ExtensionContext) {
  initializeConnectionLog(context);
  const workspaceIdentity = vscode.workspace.workspaceFile?.toString() || vscode.workspace.workspaceFolders?.map(folder => folder.uri.toString()).sort().join('|') || context.storageUri?.toString();
  const workspaceId = await initializeInstance(context, vscode.workspace.name, workspaceIdentity ? `${vscode.env.machineId}:${workspaceIdentity}` : undefined);
  await initializeSecrets(context, workspaceId);
  const updatePowerStatus = () => store.getState().webview.panel?.webview.postMessage({ type: 'power', active: keepAwake.active, enabled: vscode.workspace.getConfiguration('aircodum').get<boolean>('keepAwake', false) });
  const keepAwake = new KeepAwake(updatePowerStatus, message => { vscode.window.showErrorMessage(message); });
  const syncPower = () => keepAwake.update(vscode.workspace.getConfiguration('aircodum').get<boolean>('keepAwake', false), store.getState().server.isRunning);
  const unsubscribePower = store.subscribe(syncPower);
  context.subscriptions.push({ dispose: () => { unsubscribePower(); keepAwake.stop(); } });
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('aircodum.keepAwake')) { syncPower(); updatePowerStatus(); } }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.toggleAirCodumKeepAwake', async () => {
    const config = vscode.workspace.getConfiguration('aircodum');
    await config.update('keepAwake', !config.get<boolean>('keepAwake', false), vscode.ConfigurationTarget.Global);
    syncPower(); updatePowerStatus();
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.aircodumPowerStatus', updatePowerStatus));

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
      const configuredPort = vscode.workspace.getConfiguration("aircodum").get<number>("port", 0);
      await startServer(address, await getPairingToken(DEFAULT_PORT), {
        port: configuredPort || preferredPort(), autoPort: configuredPort === 0, pairingTokenForPort: resolvePairingToken,
      });
      await rememberPort(store.getState().server.port);
    } catch (error) {
      vscode.window.showErrorMessage(`AirCodum could not start: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  context.subscriptions.push(vscode.commands.registerCommand("extension.configureAirCodumConnection", async () => {
    const interfaces = networkInterfaces();
    const addresses = tailscaleAddresses(interfaces);
    const localAddresses = localNetworkAddresses(interfaces);
    const choices = [
      ...localAddresses.map(address => ({ label: "Local Wi-Fi / Ethernet", description: address, detail: "Same local network. Pairing required; traffic is not encrypted. Use a network you trust.", address })),
      ...addresses.map(address => ({ label: "Tailscale", description: address, detail: "Encrypted connection, including when your phone is away from home.", address })),
      { label: "Localhost / TLS proxy", description: "127.0.0.1", detail: "This computer only, or your configured TLS reverse proxy.", address: "127.0.0.1" },
    ];
    const choice = await vscode.window.showQuickPick(choices, {
      title: "AirCodum connection",
      placeHolder: addresses.length || localAddresses.length ? "Choose local Wi-Fi or Tailscale for your phone" : "No network address found. Connect to Wi-Fi, Ethernet or Tailscale, then try again.",
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

  context.subscriptions.push(vscode.commands.registerCommand('extension.renameAirCodumInstance', async () => {
    const name = await vscode.window.showInputBox({ title: 'Name this workspace', prompt: 'Shown on your phone so you can tell your connections apart.', value: getInstance().name, validateInput: value => value.trim() && value.trim().length <= 80 ? undefined : 'Enter a name up to 80 characters.' });
    if (name !== undefined) await renameInstance(name);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.configureAirCodumPort', async () => {
    const configured = vscode.workspace.getConfiguration('aircodum').get<number>('port', 0);
    const value = await vscode.window.showInputBox({ title: 'Connection port', prompt: 'Use 0 for automatic selection. Each VS Code window needs its own available port. Changing it disconnects this window’s phones.', value: String(configured), validateInput: value => /^\d+$/.test(value) && (Number(value) === 0 || validPort(Number(value))) ? undefined : 'Enter 0 for automatic, or a port from 1024 to 65535.' });
    if (value === undefined || Number(value) === configured) return;
    await vscode.workspace.getConfiguration('aircodum').update('port', Number(value), vscode.workspace.workspaceFolders?.length ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global);
    stopServer();
    await startServerAndWebview();
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

  return { getConnectionInfo: () => ({ ...store.getState().server, instance: getInstance() }) };
}

export function deactivate() { stopServer(); }
