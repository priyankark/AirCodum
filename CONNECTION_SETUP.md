## Connect from the extension UI (0.2.2)

Open **AirCodum** using **Open AirCodum Webview**. Under **Connect your phone**, use **Choose connection** and select the detected Tailscale address. This saves the address and starts the listener there. Connect Tailscale on both devices with the same account. Enter the displayed host and port in the phone app, choose **Tailscale / localhost (ws)**, and use **Copy pairing key** to transfer the key. The UI reports the active listener, even if the saved setting changes before restart. Start and stop controls remain available in the panel.

# Connecting AirCodum to VS Code

Use [AirCodum-Mobile](https://github.com/priyankark/AirCodum-Mobile), package `com.codeair`, with this extension. [AirCodum-Agnentum-Mobile](https://github.com/priyankark/AirCodum-Agnentum-Mobile) is the separate app for Agentum CLI.

1. Install dependencies and run `npm run compile` under `extension/`, then load the extension in a trusted VS Code workspace.
2. Set application-level `aircodum.bindAddress` to the desktop's actual Tailscale IP, or keep localhost behind a TLS reverse proxy. Servers reject wildcard/public/ordinary LAN binds. An address in the Tailscale range alone does not create encryption.
3. Run **Start AirCodum Server**, then **AirCodum: Copy Pairing Token** in the Command Palette.
4. In the original mobile app, enter the host, port **11040**, and pairing token. Select TLS for a certificate-validated HTTPS proxy, or **Tailscale / localhost (ws)** for the protected direct connection. A TLS proxy must forward WebSocket upgrades and Authorization headers.
5. Open VNC. Commands, uploads, frames and input share one socket. Supported features are detected automatically; see [COMPATIBILITY.md](COMPATIBILITY.md).

Tokens grant desktop control and are stored in VS Code SecretStorage and the app's native SecureStore. Restarting the extension preserves its token. Re-enter the OpenAI API key once in the extension webview; it is also stored in SecretStorage. Existing workspace `.env` files remain untouched.

Rebuild the mobile native binary to include SecureStore. Expo exports or Metro reloads alone cannot add a native module. Run Expo prebuild for Android or install iOS pods using the app's existing native build workflow.

Send inserts the local text draft; Enter presses a separate desktop key. Leaving VNC or backgrounding the app stops capture when supported by the server. Old extensions retain their legacy automatic capture behavior.

Validation commands: `npm run compile` and `npm run test:security` in the extension; `npx tsc --noEmit` and `npm run test:security` in the original mobile repo. See [NATIVE_VALIDATION.md](NATIVE_VALIDATION.md) for real VS Code and Android testing.

The separate Agentum stack uses ports 11042/11043 and its own pairing credential. Its setup belongs to the [Agentum CLI PR](https://github.com/priyankark/agentum-cli/pull/3).

## QR and sleep recovery (extension 0.2.3 / mobile 2.4.1)

QR is optional; manual TLS/Tailscale host, port and token entry remains supported. QR images are generated locally and hidden when the listener changes. Both mobile platforms validate the payload, store the credential in SecureStore and use the existing authenticated handshake.

Keep Mac awake holds a process-scoped macOS power assertion only while the server runs; stop, disable, or exit releases it. It changes no global power preferences. Lid closure can still force sleep. Apple-supported closed-display operation needs power, an external display, and keyboard/mouse. This extension cannot serve requests while the OS is asleep. Mobile retries continue with capped backoff while active, recover on foreground, and stop after Disconnect or authentication rejection.

References: https://developer.apple.com/documentation/iokit/kiopmassertiontypepreventuseridlesystemsleep and https://support.apple.com/en-us/117373
