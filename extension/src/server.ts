import * as http from "http";
import { WebSocketServer } from "ws";
import * as vscode from "vscode";
import { handleWebSocketConnection } from "./websockets";
import { store } from "./state/store";
import { setServerRunning, setWebSocketServer } from "./state/actions";
import { authorized, MAX_PAYLOAD, allowedBind } from "./security";
import { validPort, DEFAULT_PORT } from "./instance";
import { connectionLog } from './connection-log';

let listener: http.Server | undefined;
let starting = false;
let startCompletion: Promise<void> = Promise.resolve();
let generation = 0;

export interface StartOptions { port?: number; autoPort?: boolean; pairingTokenForPort?: (port: number) => string }

export async function startServer(address: string, token: string, options: StartOptions = {}): Promise<void> {
  if (store.getState().server.isRunning) return;
  if (starting) {
    await startCompletion;
    return startServer(address, token, options);
  }
  if (!vscode.workspace.isTrusted) throw new Error("Trust this workspace before enabling remote control.");
  if (token.length < 32) throw new Error("A pairing token is required.");
  if (!allowedBind(address)) throw new Error("Choose a local Wi-Fi or Tailscale interface address, or localhost behind a TLS proxy. Public and wildcard listeners are not allowed.");
  const requestedPort = options.port ?? store.getState().server.port;
  if (requestedPort !== 0 && !validPort(requestedPort)) throw new Error("Choose a port from 1024 to 65535.");
  starting = true;
  let completeStart!: () => void;
  startCompletion = new Promise(resolve => { completeStart = resolve; });
  const run = ++generation;
  let listenerToken = token;
  const httpServer = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
  httpServer.on('clientError', (error: Error & { rawPacket?: Buffer }, socket) => {
    const tls = error.rawPacket?.[0] === 0x16;
    connectionLog(`Rejected transport from ${(socket as import('net').Socket).remoteAddress ?? 'unknown'}: ${tls ? 'TLS requested on plain WebSocket port; use Tailscale / localhost (ws)' : 'invalid HTTP handshake'}`);
    socket.destroy();
  });
  const wss = new WebSocketServer({
    server: httpServer, maxPayload: MAX_PAYLOAD, perMessageDeflate: false,
    verifyClient: ({ req }: { req: import('http').IncomingMessage }) => {
      const paired = authorized(req, listenerToken);
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
    let candidate = requestedPort;
    for (let attempt = 0; ; attempt++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => { httpServer.removeListener("error", failed); httpServer.removeListener("close", cancelled); };
          const failed = (error: Error) => { cleanup(); reject(error); };
          const cancelled = () => { cleanup(); reject(new Error("Server start cancelled.")); };
          httpServer.once("error", failed);
          httpServer.once("close", cancelled);
          httpServer.listen(candidate, address, () => { cleanup(); resolve(); });
        });
        break;
      } catch (error) {
        if (run !== generation || !options.autoPort || (error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || attempt >= 99) throw error;
        candidate = candidate >= 65535 ? DEFAULT_PORT : candidate + 1;
      }
    }
    if (run !== generation) throw new Error("Server start cancelled.");
    const actual = httpServer.address();
    if (!actual || typeof actual === 'string') throw new Error("Unable to determine the listening port.");
    listenerToken = options.pairingTokenForPort ? options.pairingTokenForPort(actual.port) : token;
    httpServer.on("error", () => stopServer());
    store.setState({ server: { isRunning: true, address, port: actual.port } });
    setWebSocketServer(wss);
    connectionLog(`Listening on ${address}:${actual.port}`);
    vscode.window.showInformationMessage(`AirCodum listening on ${address}:${store.getState().server.port}. Use Copy Pairing Token to connect.`);
  } catch (error) {
    wss.close(); httpServer.close(); listener = undefined;
    throw error;
  } finally { starting = false; completeStart(); }
}

export function stopServer(): void {
  generation++;
  const { websocket } = store.getState();
  for (const client of websocket.wss?.clients ?? []) client.terminate();
  websocket.wss?.close();
  listener?.close(); listener = undefined;
  setWebSocketServer(null);
  setServerRunning(false);
}
