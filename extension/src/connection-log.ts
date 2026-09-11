import * as vscode from 'vscode';

let output: vscode.OutputChannel | undefined;

export function initializeConnectionLog(context: vscode.ExtensionContext) {
  output = vscode.window.createOutputChannel('AirCodum Connections');
  context.subscriptions.push(output);
}

export function showConnectionLog() { output?.show(true); }

/** Only pass fixed event descriptions, network addresses and numeric close codes. */
export function connectionLog(event: string) {
  try { output?.appendLine(`${new Date().toISOString()} ${event}`); } catch { /* Logging must not interrupt a connection. */ }
}
