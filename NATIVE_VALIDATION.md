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

The host runner saved the fixture and reported `pass: true` with VS Code version 1.121.0. The six extension targeted tests, sixteen original-mobile targeted tests and TypeScript checks pass. Original-mobile Android/iOS JavaScript/Hermes exports pass. Both Android and iOS were subsequently built and installed natively, as recorded below.

## Original native iOS → actual VS Code — September 8

Xcode 26.2 built the original app and ran its native XCTest on iPhone 16 / iOS 18.4. The full desktop-mode flow passed wrong-token rejection, authenticated connection, real VS Code command/selection assertions, local draft deletion/replacement, Cmd+A, Send and Enter, background/foreground and extension restart/reconnection. The VNC view was visually checked against the real VS Code desktop. The actual editor ended with exactly `IOS-E2E-12Z\n`; the host returned `pass: true, mode: "desktop"`, and Xcode reported TEST SUCCEEDED. The separate Agentum app is not covered by this iOS result.

The harness now focuses only the isolated VS Code process and explicitly labels optional transport-only runs. Full Android/iOS runners reject transport-only mode. Test setup and signing details live in the original mobile repo's IOS_TESTING.md. Native app traffic connects directly to the extension; the authenticated loopback test bridge only coordinates assertions and lifecycle commands.

## Regression found by this test

The packaged esbuild output resolved the default `ws` import to the WebSocket class without `.Server`, causing `wrapper_default.Server is not a constructor` at startup. CommonJS source tests missed this. The server now imports and constructs the named `WebSocketServer`, and the actual-host run passes with the compiled package.

Earlier Agentum native testing also found Android's automatic Origin header, native Enter naming and stuck macOS shortcut modifiers. Those fixes are included here and exercised again by the correct app-to-VS-Code flow.

## Performance evidence and limits

Earlier local macOS capture benchmarks compared screenshot-desktop/Jimp with the native screencapture/sips helper now used by both backends: median capture plus resize/encode fell from 770 ms to 145 ms (10 samples, 1440×900, JPEG quality 85). The separate Agentum run observed about 6–7 server-sent frames/second. This is shared capture-path evidence, **not a measured original-mobile frame rate or touch-to-display latency**. Network and mobile decoding/painting add costs.

See the [original mobile validation report](https://github.com/priyankark/AirCodum-Mobile/blob/codex/secure-vnc-keyboard/NATIVE_VALIDATION.md) for reproduction commands, test permissions and dependency audit. Its audit is now 9 high affected-package alerts covering locally patched/mitigated dependencies and parents; see its DEPENDENCY_SECURITY.md. This extension's npm audit is zero. No physical-device testing, production TLS/Tailscale E2E, Windows/Linux input, camera/file-picker/voice/AI workflow testing or app-store release was performed. Android background testing asserted connectivity; capture lifecycle is covered separately by the server integration tests.

The runner intentionally uses a disposable workspace/profile for native typing and disables trust prompts only there. Keep its private `ready.json` pairing token out of logs and PR artifacts. [COMPATIBILITY.md](COMPATIBILITY.md) documents automatic feature negotiation and the old-app/new-server authentication boundary.


## Packaged extension with SDK 54 store binaries — September 9, 2026

The published GitHub pre-release VSIX for AirCodum 0.2.0 was extracted and loaded into actual VS Code 1.121.0. Native Android and iOS E2E passed against that packaged runtime, without mocked servers, editor APIs, screen capture or desktop input.

Android used a universal emulator APK derived from the production AirCodum-Mobile 2.4.0/build 28 AAB (`00f970aa-aeff-4cc1-9d07-b9d2e7cf9bbf`). iOS used the EAS simulator build (`aec8ac64-2462-444b-96e6-35a4aae084f9`) containing its release JavaScript bundle. Both passed wrong-token rejection, pairing, Select All/Move Cursor to End, local draft editing, Cmd+A + Send + Enter, exact document text/newline, background/foreground and server restart/reconnect. Final host results contain `AIR-E2E-12Z\n` and `IOS-E2E-12Z\n`; XCTest reported TEST EXECUTE SUCCEEDED.

The opt-in host setting `AIRCODUM_E2E_FOCUS_HOLD_MS=10000` keeps only its isolated VS Code process in front for up to ten seconds after focus requests during automation. Keep macOS awake and reserve the desktop for these tests. Mobile drivers also wake Android, reject stale UI hierarchies and pace native XCTest typing. These test-driver changes do not change the released extension runtime.

VSIX SHA-256: `2817f4d109d8edd58c9819c77bf6c0e0e2105dc1da070e62c3d07ef893167c9e`. Full release/build/submission status is tracked in AirCodum-Mobile's STORE_RELEASE.md. Physical devices, production TLS/Tailscale, Windows/Linux and camera/file-picker/voice/AI flows remain outside this validation.

## GA promotion — September 10, 2026

Version 0.2.1 promotes the tested 0.2.0 runtime to the stable Marketplace channel
after iOS AirCodum 2.4.0 reached READY_FOR_SALE. Android build 28 remains in review.
Marketplace requires different version numbers for pre-release and stable builds.
The GA VSIX was made from the verified original VSIX, preserving each ZIP entry's
metadata and bytes except `extension/package.json` (version 0.2.0 → 0.2.1) and
`extension.vsixmanifest` (version increment and removal of PreRelease=true).
Comparison of all 14 entries confirmed that every runtime file, including bundled
JavaScript and all native modules, is byte-identical. This promotion does not
represent another native mobile E2E run; the runtime coverage above applies.

GA VSIX SHA-256: `831d840500ab6c07b862296f223490f8e8f5a2824a05ff3e4cb748f20d099cf6`.

The public Marketplace catalog confirmed 0.2.1 without the PreRelease property.
The downloaded Marketplace package matched the GA SHA-256 after HTTP gzip
decoding. A fresh isolated VS Code 1.121.0 profile installed
`priyankark.aircodum-app` as 0.2.1 without `--pre-release` or a pinned version.
