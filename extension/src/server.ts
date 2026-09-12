import * as http from "http";
import { WebSocketServer } from "ws";
import * as vscode from "vscode";
import { handleWebSocketConnection } from "./websockets";
import { store } from "./state/store";
import { setServerAddress, setServerRunning, setWebSocketServer } from "./state/actions";
import { authorized, MAX_PAYLOAD, allowedBind } from "./security";
import { connectionLog } from './connection-log';

let listener: http.Server | undefined;
let starting = false;

export async function startServer(address: string, token: string): Promise<void> {
  if (store.getState().server.isRunning || starting) return;
  if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before enabling remote control.");
  if (token.length < 32) throw new Error("A pairing token is required.");
  if (!allowedBind(address)) throw new Error("Choose a local Wi-Fi or Tailscale interface address, or localhost behind a TLS proxy. Public and wildcard listeners are not allowed.");
  starting = true;
  const httpServer = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
  httpServer.on('clientError', (error: Error & { rawPacket?: Buffer }, socket) => {
    const tls = error.rawPacket?.[0] === 0x16;
    connectionLog(`Rejected transport from ${(socket as import('net').Socket).remoteAddress ?? 'unknown'}: ${tls ? 'TLS requested on plain WebSocket port; use Tailscale / localhost (ws)' : 'invalid HTTP handshake'}`);
    socket.destroy();
  });
  const wss = new WebSocketServer({
    server: httpServer, maxPayload: MAX_PAYLOAD, perMessageDeflate: false,
    verifyClient: ({ req }: { req: import('http').IncomingMessage }) => {
      const paired = authorized(req, token);
      const accepted = wss.clients.size < 4 && paired;
      const reason = wss.clients.size >= 4 ? 'client limit reached' :
        req.headers.origin !== undefined && req.headers.origin !== 'aircodum://native' ? 'unsupported client origin' :
        !req.headers.authorization ? 'missing pairing key' : 'incorrect pairing key';
      connectionLog(`WebSocket ${accepted ? 'accepted' : `rejected: ${reason}`} from ${req.socket.remoteAddress ?? 'unknown'}`);
      return accepted;
    },
  });
  // The HTTP listener owns startup/runtime errors; consume ws’s forwarded copy.
  wss.on("error", () => {});
  const alive = new WeakMap<import('ws'), boolean>();
  wss.on('connection', (socket, request) => {
    const peer = request.socket.remoteAddress ?? 'unknown';
    socket.on('close', code => connectionLog(`WebSocket closed from ${peer}: code ${code}`));
    alive.set(socket, true);
    socket.on('pong', () => alive.set(socket, true));
    handleWebSocketConnection(socket);
  });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.get(socket)) { socket.terminate(); continue; }
      alive.set(socket, false);
      socket.ping();
    }
  }, 30000);
  heartbeat.unref();
  wss.once('close', () => clearInterval(heartbeat));
  listener = httpServer;
  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(store.getState().server.port, address, () => {
        httpServer.removeListener("error", reject);
        httpServer.on("error", () => stopServer());
        setServerAddress(address);
        setServerRunning(true);
        setWebSocketServer(wss);
        connectionLog(`Listening on ${address}:${store.getState().server.port}`);
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
  const { websocket } = store.getState();
  for (const client of websocket.wss?.clients ?? []) client.terminate();
  websocket.wss?.close();
  listener?.close(); listener = undefined;
  setWebSocketServer(null);
  setServerRunning(false);
}
