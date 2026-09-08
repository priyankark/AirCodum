# Connecting the updated stack

The updated app detects supported server features automatically; see `COMPATIBILITY.md`. Old unauthenticated apps are still rejected by the authenticated servers. Keep pairing tokens private: they grant desktop and terminal control.

## Agentum

1. Run `npm install` and `npm run build` in agentum-cli.
2. For Tailscale, run `ag server --host <your-desktop-Tailscale-IP>`. The terminal port is 11042 and VNC is 11043 by default. Listeners reject wildcard, public, and ordinary LAN binds. Without `--host`, they listen only on localhost.
3. Run `ag pairing-token` locally and paste the token into the mobile connection settings. The generated token is stored at `~/.agentum/pairing-token`, mode 0600; `AGENTUM_AUTH_TOKEN` can supply a 32–256 character token instead. Both ports use the same token.
4. In mobile, enter the Tailscale IPv4 address and port 11042. Select **Tailscale / localhost (ws)**. This must be an actual Tailscale interface; an address in the same range alone does not create encryption. Leave the VNC port blank to use the next port, or enter 11043.
5. For TLS, leave servers on localhost and configure an HTTPS reverse proxy to forward WebSocket upgrades and the `Authorization` header. Enter its hostname/ports in mobile and enable TLS. Certificates must be trusted by the device. Do not bypass certificate checks.

A token is stable across server restarts. To revoke it, stop the server, remove only the pairing-token file (or replace the environment token), restart, and pair the app again. Restarting closes existing authorized connections.

Agent execution now uses normal permission/sandbox behavior. A local operator who explicitly needs the previous unrestricted behavior can set `AGENTUM_ALLOW_UNSANDBOXED=1` before starting the server; it is not configurable by a remote message.

## VS Code extension

1. Run `npm install` and `npm run compile` under `extension/`, then load the updated extension in a trusted VS Code workspace.
2. Set the application-level `aircodum.bindAddress` setting to the desktop's Tailscale IP, or retain localhost behind a TLS reverse proxy.
3. Run **Start AirCodum Server**, then **AirCodum: Copy Pairing Token** from the Command Palette.
4. In mobile use port **11040**, the app automatically uses the same port for VNC. The extension serves both connections on the same listener. Agent session modes require Agentum, not the extension.
5. Paste the extension's token and select the matching transport. The extension and Agentum have different pairing credentials.

Re-enter the OpenAI API key once in the extension's webview. It is now saved in VS Code SecretStorage; the extension no longer reads or writes workspace `.env` keys. Existing `.env` files are untouched. If a previous key was committed or exposed in logs, rotate it and remove it from the relevant history separately.

## Mobile/native build

Install dependencies, then rebuild the app to include `expo-secure-store`. The existing iOS/Android directories are generated and ignored by Git. Use your existing native-build workflow; for an existing iOS project run CocoaPods installation before building. Keep `newArchEnabled: false` with Reanimated 3 unless performing an intentional architecture migration.

Open VNC to start streaming. Leaving VNC, backgrounding, or disconnecting stops that stream. Text is composed locally: **Send** types the draft, and **Enter** presses the desktop's Enter key separately. Navigation and shortcut keys send immediately.

## Checks

- Extension: `npm run compile` and `npm run test:security`.
- Agentum: `npm run test:security` (also builds).
- Mobile: `npx tsc --noEmit`, `npm run test:security`, and Expo exports for iOS/Android.

The security tests use Node's test runner and timer mocks; run them on Node 22 or newer. Older manually maintained Agentum test clients must send `{ headers: { Authorization: 'Bearer <token>' } }` in their `ws` constructor options. They cannot connect anonymously anymore.
