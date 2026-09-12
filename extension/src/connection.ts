import type { NetworkInterfaceInfo } from "os";
import { protectedBind } from "./security";

export function tailscaleAddresses(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string[] {
  return [...new Set(Object.values(interfaces).flatMap(entries => entries ?? [])
    .filter(entry => !entry.internal && !entry.address.includes(":") && protectedBind(entry.address))
    .map(entry => entry.address))].sort();
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
