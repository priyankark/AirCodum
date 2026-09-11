## 0.2.3

- Added QR pairing with AirCodum mobile 2.4.1; manual connection controls remain available.
- Added Keep Mac awake while the server runs, with guidance for supported closed-display use.
- Added heartbeat support and removal of stale connections after sleep or network interruption.

## 0.2.2

- Added connection controls showing the active host, port, and server status.
- Added Copy pairing key and a detected Tailscale address selector.
- Keep connection controls available when the server stops or fails to start.
- Explain when localhost cannot be reached directly from a phone.

# Changelog

## 0.2.0 (pre-release)

- Require pairing for desktop commands, uploads and VNC; store credentials in SecretStorage.
- Add protected transport/bind restrictions, upload/input limits and webview hardening.
- Capture only for subscribed VNC clients; serialize capture and drop stale frames. Use asynchronous native macOS capture/resize.
- Negotiate mobile capabilities automatically. Requires the updated original AirCodum app; old apps remain compatible with the older extension.
- Correct native Enter/modifier handling and packaged WebSocket server startup.
- Validate original Android and iOS simulator flows against the actual VS Code extension. Store SDK upgrade validation is recorded separately in the mobile release report.
