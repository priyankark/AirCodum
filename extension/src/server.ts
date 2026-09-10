import * as http from "http";
import { WebSocketServer } from "ws";
import * as vscode from "vscode";
import { handleWebSocketConnection } from "./websockets";
import { store } from "./state/store";
import { setServerRunning, setWebSocketServer } from "./state/actions";
import { authorized, MAX_PAYLOAD, protectedBind } from "./security";

let listener: http.Server | undefined;
let starting = false;

export async function startServer(address: string, token: string): Promise<void> {
  if (store.getState().server.isRunning || starting) return;
  if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before enabling remote control.");
  if (token.length < 32) throw new Error("A pairing token is required.");
  if (!protectedBind(address)) throw new Error("Use localhost behind a TLS proxy, or bind to your Tailscale interface IP.");
  starting = true;
  const httpServer = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
  const wss = new WebSocketServer({
    server: httpServer, maxPayload: MAX_PAYLOAD, perMessageDeflate: false,
    verifyClient: ({ req }: { req: import('http').IncomingMessage }) => wss.clients.size < 4 && authorized(req, token),
  });
  wss.on("connection", handleWebSocketConnection);
  listener = httpServer;
  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(store.getState().server.port, address, () => {
        httpServer.removeListener("error", reject);
        httpServer.on("error", () => stopServer());
        setServerRunning(true);
        setWebSocketServer(wss);
        resolve();
      });
    });
    vscode.window.showInformationMessage(`AirCodum listening on ${address}:${store.getState().server.port}. Use Copy Pairing Token to connect.`);
  } catch (error) {
    wss.close(); httpServer.close(); listener = undefined;
    throw error;
  } finally { starting = false; }
}

export function stopServer(): void {
  const { websocket, webview } = store.getState();
  for (const client of websocket.wss?.clients ?? []) client.terminate();
  websocket.wss?.close();
  listener?.close(); listener = undefined;
  setWebSocketServer(null);
  setServerRunning(false);
  webview.panel?.dispose();
}
