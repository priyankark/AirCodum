# Native validation — September 7, 2026

The initial PRs had unit/integration tests and JavaScript exports, but no native E2E run. The Android testing below was performed after that omission was raised. All three PRs remain drafts pending the remaining release checks.

## Executed

- Built the native Android debug APK with Gradle 8.14.3, installed it on the Pixel 3a Android API 34 ARM64 emulator, and loaded this branch through Metro. This exercises the real React Native WebSocket and SecureStore modules.
- Paired the app to the actual Agentum CLI server over `adb reverse`, with native macOS screen capture and RobotJS input. No capture or input mocks were used for this flow.
- Confirmed the desktop image appears in the Android VNC view.
- Edited `AIR-E2E-123` to `AIR-E2E-12Z` in the Android composer. Asserted the desktop fixture remained unchanged before Send, then used the app's ⌘A, Send and Enter controls. Asserted the TextEdit document contained exactly `AIR-E2E-12Z\n`.
- Confirmed pairing settings/token survive an app restart and can reconnect.
- Observed server capture stop and socket close when switching away from VNC and when backgrounding Android. Foregrounding reconnects VNC.
- A separate real desktop input probe passed Cmd+A, text, Backspace and Enter at event spacings of 50, 150 and 1,000 ms.
- All 24 targeted automated tests pass: extension 6, CLI 7, mobile 11. TypeScript checks and extension packaging pass.

## Bugs found by native testing

1. React Native Android automatically supplies an HTTP Origin. The server initially rejected it, causing HTTP 401 despite a correct pairing token. The app now supplies `Origin: aircodum://native`; both servers accept that exact marker or absent Origin, and still require the bearer token. Browser origins and `null` remain rejected. The marker is not a credential.
2. RobotJS expects `enter`, not `return`. Both names now normalize to `enter`.
3. macOS modifier flags persisted after shortcuts and interfered with subsequent text. Native handlers now release modifiers explicitly in a finally block.
4. Capture enumerated displays with `system_profiler` on every frame and decoded/resized/encoded JPEG on the JavaScript input thread. The macOS path now uses `screencapture -m` and asynchronous `sips`, with argument arrays, timeouts and private temporary files cleaned on success/error. Other operating systems retain the existing processing path.

## Measured capture performance

Same machine, 10 samples per path, 1440×900 output and JPEG quality 85:

| Capture + resize/encode path | Median | Maximum |
| --- | ---: | ---: |
| screenshot-desktop + Jimp | 770 ms | 1,117 ms |
| macOS native tools | 145 ms | 214 ms |

The connected Android stream showed about 6–7 sent frames/second and roughly 150 ms server processing, compared with about 1–2 frames/second before. These are local capture/processing and server-send measurements, **not touch-to-display latency or physical-device FPS**. Network, base64 transfer and mobile decode/paint are additional costs. Thirty FPS remains a target, not a measured result.

## Reproduction and limitations

See the [mobile native validation report](https://github.com/priyankark/AirCodum-Agnentum-Mobile/blob/codex/secure-vnc-keyboard/NATIVE_VALIDATION.md) for the Android script and complete limitations. The CLI provides `node tests/benchmark-native-capture.cjs` after `npm run build` to repeat the local capture comparison. iOS, physical devices, Windows/Linux, the full VS Code host and production-network latency remain unverified. The existing mobile dependency findings remain unresolved.

Automatic compatibility changes and additional Android checks are described in [COMPATIBILITY.md](COMPATIBILITY.md).
