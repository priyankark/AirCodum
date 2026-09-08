import * as vscode from "vscode";
import { randomBytes } from "crypto";
let secrets: vscode.SecretStorage;
let apiKey: string | undefined;

export async function initializeSecrets(context: vscode.ExtensionContext) {
  secrets = context.secrets;
  apiKey = await secrets.get("aircodum.openaiApiKey");
}
export function getApiKey(): string | undefined { return apiKey; }
export async function saveApiKey(key: string): Promise<void> {
  if (typeof key !== "string" || !key.trim() || key.length > 1024) return;
  await secrets.store("aircodum.openaiApiKey", key.trim());
  apiKey = key.trim();
  vscode.window.showInformationMessage("API key saved securely.");
}
export async function getPairingToken(): Promise<string> {
  let token = await secrets.get("aircodum.pairingToken");
  if (!token) {
    token = randomBytes(32).toString("hex");
    await secrets.store("aircodum.pairingToken", token);
  }
  return token;
}
