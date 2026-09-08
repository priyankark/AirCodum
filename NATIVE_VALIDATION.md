# Actual VS Code + AirCodum mobile validation

Validated September 7, 2026 with **AirCodum-Mobile (`com.codeair`)**, the original VS Code companion. The separate Agentum mobile/CLI tests do not substitute for this workflow.

## Passed on the real stack

VS Code 1.121.0 arm64 ran this compiled extension in an isolated profile and disposable workspace. `extension/tests/vscode-native.cjs` exercised actual activation, the webview, start/stop commands, SecretStorage pairing, rejection of anonymous upgrades, authenticated capabilities, capture on demand, native JPEG output and VS Code editor command APIs. These native-host paths were not mocked.

The original mobile app's native Android APK (Expo 51, React Native 0.74.5) was built with Gradle 8.8/NDK 26.1 and installed on the Pixel 3a API 34 ARM64 emulator. Its `tests/android-vscode-e2e.py` then:

- Rejected a wrong pairing token and connected with the correct token over `adb reverse`.
- Sent Select All and Move Cursor to End from the app command UI and asserted the actual VS Code editor selection.
- Displayed the real VS Code desktop in Android VNC (visually inspected).
- Edited the native Android draft from `AIR-E2E-123` to `AIR-E2E-12Z`; confirmed the desktop remained `fixture` before Send.
- Used the app's ⌘A, Send and Enter controls; asserted the actual VS Code document contained exactly `AIR-E2E-12Z\n`.
- Backgrounded/foregrounded Android, then restarted the actual extension server and verified token persistence and app reconnection.

The host runner saved the fixture and reported `pass: true` with VS Code version 1.121.0. The six extension targeted tests, ten original-mobile targeted tests and TypeScript checks pass. Original-mobile Android/iOS JavaScript/Hermes exports pass; only Android was built and installed natively.

## Regression found by this test

The packaged esbuild output resolved the default `ws` import to the WebSocket class without `.Server`, causing `wrapper_default.Server is not a constructor` at startup. CommonJS source tests missed this. The server now imports and constructs the named `WebSocketServer`, and the actual-host run passes with the compiled package.

Earlier Agentum native testing also found Android's automatic Origin header, native Enter naming and stuck macOS shortcut modifiers. Those fixes are included here and exercised again by the correct app-to-VS-Code flow.

## Performance evidence and limits

Earlier local macOS capture benchmarks compared screenshot-desktop/Jimp with the native screencapture/sips helper now used by both backends: median capture plus resize/encode fell from 770 ms to 145 ms (10 samples, 1440×900, JPEG quality 85). The separate Agentum run observed about 6–7 server-sent frames/second. This is shared capture-path evidence, **not a measured original-mobile frame rate or touch-to-display latency**. Network and mobile decoding/painting add costs.

See the [original mobile validation report](https://github.com/priyankark/AirCodum-Mobile/blob/codex/secure-vnc-keyboard/NATIVE_VALIDATION.md) for reproduction commands, test permissions and dependency audit. Its audit remains 29 affected packages, including one critical build-tool finding; this extension's npm audit is zero. No native iOS run, physical-device testing, production TLS/Tailscale E2E, Windows/Linux input, camera/file-picker/voice/AI workflow testing or app-store release was performed. Android background testing asserted connectivity; capture lifecycle is covered separately by the server integration tests.

The runner intentionally uses a disposable workspace/profile for native typing and disables trust prompts only there. Keep its private `ready.json` pairing token out of logs and PR artifacts. [COMPATIBILITY.md](COMPATIBILITY.md) documents automatic feature negotiation and the old-app/new-server authentication boundary.
