# AirCodum VS Code compatibility

This app (`com.codeair`) pairs with [AirCodum's VS Code extension](https://github.com/priyankark/AirCodum). [AirCodum-Agnentum-Mobile](https://github.com/priyankark/AirCodum-Agnentum-Mobile) is the separate Agentum app.

No rollout flags or server version selection are needed. On each connection, a new extension announces `server_capabilities`, protocol version 1, with `vncSharedPort: true`. The app uses the existing main socket for commands, files, screen frames and native input. Capture start/stop and text insertion are enabled only when advertised.

An old extension sends no announcement. The app keeps the original `mouse-event` and `keyboard-event` wire format and never sends new JSON commands that old extensions could mistake for uploads. Its text composer requires the updated extension. Legacy automatic screen capture remains a server limitation.

An empty pairing field supports old servers on loopback/Tailscale or TLS, and on private LAN IPv4 with mobile 2.4.2. A supplied token is always sent; HTTP 401/403 stops retries and shows pairing instructions. The app never retries anonymously after a rejected token. New servers require the pairing token from the VS Code command **AirCodum: Copy Pairing Token**. It is saved in native SecureStore.

| App | Extension | Behavior |
| --- | --- | --- |
| Old | Old | Existing behavior; installing this PR elsewhere does not move an existing connection. |
| New | Old | Existing commands, uploads and legacy VNC; new text/stream-control features disabled. |
| New | New | Secure pairing and automatically enabled supported features. |
| Old | New | Rejected because the old app cannot supply a pairing token. Update the app before updating its server. |

App-store review does not require a remotely managed rollout. Publish the compatible app first; users can update their extension after installing it. Automatic feature negotiation cannot add authentication to an already shipped binary. No extension is published or auto-updated by these draft PRs.

## Server announcement

After authentication, this extension advertises protocol version 1 with no agent or PTY support, `vnc: true`, `vncSharedPort: true`, `vncStreamControl: true`, and `vncTextInput: true`. Existing mouse/key message names remain accepted. See `extension/tests/vscode-native.cjs` and the original mobile app native runner for the real VS Code integration test.
