# Changelog

## 0.2.0 (pre-release)

- Require pairing for desktop commands, uploads and VNC; store credentials in SecretStorage.
- Add protected transport/bind restrictions, upload/input limits and webview hardening.
- Capture only for subscribed VNC clients; serialize capture and drop stale frames. Use asynchronous native macOS capture/resize.
- Negotiate mobile capabilities automatically. Requires the updated original AirCodum app; old apps remain compatible with the older extension.
- Correct native Enter/modifier handling and packaged WebSocket server startup.
- Validate original Android and iOS simulator flows against the actual VS Code extension. Store SDK upgrade validation is recorded separately in the mobile release report.
