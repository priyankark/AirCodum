import * as vscode from "vscode";
import { randomBytes, randomUUID } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import { lock } from "proper-lockfile";
import { tokenForPort } from "../instance";
import { store } from "../state/store";
let secrets: vscode.SecretStorage;
let apiKey: string | undefined;
let basePairingToken: string;
let privatePairingRoot: string;
let pairingWorkspaceId: string;

export async function initializeSecrets(context: vscode.ExtensionContext, workspaceId: string) {
  secrets = context.secrets;
  apiKey = await secrets.get("aircodum.openaiApiKey");
  await fs.mkdir(context.globalStorageUri.fsPath, { recursive: true });
  // SecretStorage has no compare-and-set operation. Serialize initial creation
  // across extension hosts without writing a credential to the filesystem.
  let compromised: Error | undefined;
  const release = await lock(context.globalStorageUri.fsPath, {
    lockfilePath: join(context.globalStorageUri.fsPath, 'pairing-initialization.lock'),
    retries: { retries: 60, minTimeout: 100, maxTimeout: 250 },
    onCompromised: error => { compromised = error; },
  });
  try {
    const storage = context.secrets;
    let root = await storage.get("aircodum.pairingRoot");
    if (!root) {
      root = randomBytes(32).toString("hex");
      await storage.store("aircodum.pairingRoot", root);
    }
    const scopedKey = `aircodum.pairingToken.${workspaceId}`;
    let token = await storage.get(scopedKey);
    if (!token) {
      const legacy = await storage.get("aircodum.pairingToken");
      // Exclusive creation prevents two concurrently activated workspaces from
      // both claiming the old installation-wide key. The owner ID is not secret.
      if (legacy) {
        await fs.mkdir(context.globalStorageUri.fsPath, { recursive: true });
        const claim = join(context.globalStorageUri.fsPath, 'legacy-pairing-owner');
        const candidate = `${claim}.${randomUUID()}`;
        await fs.writeFile(candidate, workspaceId, { flag: 'wx', mode: 0o600 });
        try {
          // Linking a complete file publishes its contents atomically. Readers
          // cannot observe an empty owner file during concurrent activation.
          try { await fs.link(candidate, claim); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
          if ((await fs.readFile(claim, 'utf8')) === workspaceId) token = legacy;
        } finally { await fs.unlink(candidate); }
      }
      token ||= tokenForPort(root, 11040, workspaceId);
      if (compromised) throw compromised;
      await storage.store(scopedKey, token);
    }
    if (compromised) throw compromised;
    basePairingToken = token;
    privatePairingRoot = root;
    pairingWorkspaceId = workspaceId;
  } finally { await release(); }
}
export function getApiKey(): string | undefined { return apiKey; }
export async function saveApiKey(key: string): Promise<void> {
  if (typeof key !== "string" || !key.trim() || key.length > 1024) return;
  await secrets.store("aircodum.openaiApiKey", key.trim());
  apiKey = key.trim();
  vscode.window.showInformationMessage("API key saved securely.");
}
export async function getPairingToken(port = store.getState().server.port): Promise<string> {
  if (!basePairingToken) throw new Error("Pairing storage is not initialized.");
  return resolvePairingToken(port);
}
export function resolvePairingToken(port: number): string {
  if (!privatePairingRoot || !basePairingToken) throw new Error("Pairing storage is not initialized.");
  return port === 11040 ? basePairingToken : tokenForPort(privatePairingRoot, port, pairingWorkspaceId);
}
