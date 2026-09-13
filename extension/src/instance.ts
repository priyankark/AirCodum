import { createHash, createHmac, randomUUID } from 'crypto';
import { hostname } from 'os';
import type * as vscode from 'vscode';
import { store } from './state/store';

export const DEFAULT_PORT = 11040;
export interface InstanceInfo { id: string; name: string; sharedDesktop: true }
let workspaceId = 'uninitialized';
let instanceName = 'AirCodum';
let workspaceState: vscode.Memento | undefined;

export function validPort(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1024 && Number(value) <= 65535;
}

export function cleanInstanceName(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
}

export async function initializeInstance(context: vscode.ExtensionContext, workspaceName?: string, identity?: string): Promise<string> {
  workspaceState = context.workspaceState;
  const existing = workspaceState.get<string>('aircodum.instanceId');
  workspaceId = identity ? createHash('sha256').update(identity).digest('hex') : existing || randomUUID();
  if (workspaceId !== existing) await workspaceState.update('aircodum.instanceId', workspaceId);
  instanceName = cleanInstanceName(workspaceState.get<string>('aircodum.instanceName') ||
    `${hostname().replace(/\.local$/, '')} · ${workspaceName || 'VS Code'}`);
  return workspaceId;
}

export async function renameInstance(name: string): Promise<void> {
  const cleaned = cleanInstanceName(name);
  if (!cleaned) throw new Error('Enter a name for this workspace.');
  await workspaceState?.update('aircodum.instanceName', cleaned);
  instanceName = cleaned;
  store.setState({});
}

export function getInstance(port = store.getState().server.port): InstanceInfo {
  return {
    id: createHash('sha256').update(`${workspaceId}:${port}`).digest('hex').slice(0, 32),
    name: instanceName,
    sharedDesktop: true,
  };
}

// The root is private SecretStorage material, never a key issued to a phone.
// Knowing one listener's token therefore cannot derive another listener's token.
export function tokenForPort(root: string, port: number, identity = workspaceId): string {
  return createHmac('sha256', root).update(`aircodum-workspace:${identity}:${port}`).digest('hex');
}

export function preferredPort(): number {
  const remembered = workspaceState?.get<number>('aircodum.lastPort');
  return validPort(remembered) ? remembered : DEFAULT_PORT;
}

export async function rememberPort(port: number): Promise<void> {
  if (validPort(port)) await workspaceState?.update('aircodum.lastPort', port);
}
