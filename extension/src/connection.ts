import type { NetworkInterfaceInfo } from "os";
import { protectedBind } from "./security";

export function tailscaleAddresses(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string[] {
  return [...new Set(Object.values(interfaces).flatMap(entries => entries ?? [])
    .filter(entry => !entry.internal && !entry.address.includes(":") && protectedBind(entry.address))
    .map(entry => entry.address))].sort((a, b) => Number(a.includes(":")) - Number(b.includes(":")) || a.localeCompare(b));
}

export function connectionDetails(server: { isRunning: boolean; address: string | null; port: number }, configured: string) {
  const host = server.isRunning && server.address ? server.address : configured;
  const local = host === "localhost" || host === "::1" || host.startsWith("127.");
  return {
    host, port: server.port, running: server.isRunning,
    hint: !server.isRunning ? "Server stopped. Start it to connect your phone." : local
      ? "This address is reachable only from this Mac. Choose connection → Tailscale to connect your phone directly."
      : "Enter this host and port on your phone, then paste the pairing key.",
  };
}

export function pairingCode(server: { isRunning: boolean; address: string | null; port: number }, token: string): string {
  if (!server.isRunning || !server.address) throw new Error('Start the server before showing a pairing code.');
  const host = server.address;
  if (host === 'localhost' || host === '::1' || host.startsWith('127.')) {
    throw new Error('Choose connection → Tailscale first so your phone can reach this Mac.');
  }
  if (!protectedBind(host) || !/^[a-zA-Z0-9_-]{32,256}$/.test(token)) throw new Error('Invalid pairing settings.');
  return JSON.stringify({ type: 'aircodum-pairing', version: 1, host: host.includes(':') ? `[${host}]` : host, port: server.port, tls: false, token });
}
