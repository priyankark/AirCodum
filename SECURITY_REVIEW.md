# Security, VNC latency, and keyboard review

Reviewed September 7, 2026. Changes are local and span the AirCodum extension, Agentum CLI, and AirCodum-Agnentum-Mobile. This is a code review and remediation pass, not a certification that every security issue has been found or eliminated.

## Findings and implemented changes

| Finding | Previous behavior | Implemented behavior |
| --- | --- | --- |
| Critical: unauthenticated remote control | Extension and both Agentum ports exposed desktop input, terminal/session data, or agent execution without authentication. Extension immediately captured the desktop. | Bearer token checked during the upgrade, before handlers are registered. Browser Origin rejected. At most four clients per listener. Screen capture starts only on `vnc_start`. |
| High: plaintext network exposure | Servers bound every interface; mobile always used `ws://`. | Servers default to loopback and reject non-loopback/non-Tailscale bind addresses. Mobile supports certificate-validated `wss://`; plaintext connections are restricted to loopback/Tailscale IPs. HTTPS or Tailscale is also required for embedded code-server. TLS termination is supplied by a reverse proxy, not these Node listeners. |
| High: secret storage/logging | Extension wrote the OpenAI key into a workspace `.env`, read it into the webview, and logged state. Agentum logged prompts, keystrokes, and terminal payloads. | VS Code SecretStorage for extension secrets; private owner-only pairing file or environment credential for Agentum; mobile SecureStore for the token. Removed the identified sensitive log statements and secret DOM readback. Existing `.env` files/history are untouched. |
| High: resource exhaustion | Large frames, unbounded queued messages/frames, unrestricted session creation rate, and invalid native input. | 8 MiB terminal/upload and 64 KiB VNC limits; per-client message/byte budget; native key/modifier/coordinate validation; bounded pending work; eight remote session creations per minute; terminal backlog disconnect and VNC frame dropping when backed up. These are single-owner remote-control services, not multi-tenant sandboxes. |
| High: malformed-message/file confusion | `ws` text Buffers could be treated as file uploads after JSON/handler errors. | Route by the transport's binary flag, reject malformed JSON, and never turn failed text requests into uploaded files. Uploaded files use exclusive creation and owner-only permissions. Extension rejects a symlinked inbox. |
| High: unnecessary agent privileges | Headless agents always bypassed approvals/sandboxing. | Removed default blanket bypasses. Existing unrestricted behavior now requires the local operator to set `AGENTUM_ALLOW_UNSANDBOXED=1`. This affects unattended tools that previously relied on blanket approval. |
| High: screenshot shell interpolation | Screenshot paths were interpolated into shell commands. | `execFileSync` with argument arrays and filename/format validation. |
| Medium: embedded browser privileges | File/universal file access and mixed content allowed. Extension webview lacked CSP. | Mobile blocks file access/mixed content and restricts navigation to the configured origin. Extension uses a nonce CSP, explicit event listeners, and no local resource roots. |
| Medium: shutdown/input lifecycle | Extension leaked HTTP listener; VNC shutdown could wait indefinitely; disconnected drags could remain held. | Terminate clients, close listeners, cancel capture generations, and release held mouse buttons on stream stop/disconnect. |

## VNC changes and evidence

Both server implementations used a 100 ms coalescing timer before encoding. The extension could also permanently stop capturing after taking an early return without scheduling another capture. The replacement immediately captures/encodes, schedules against the target frame deadline, never starts a second capture while one is in flight, and invalidates old work on stop/restart.

Full-buffer SHA-256 replaces the 32-byte sampling heuristic that could miss small screen changes. Unchanged screens avoid re-encoding, with a one-second refresh for new/slow clients. Dimensions are frozen for each frame. Capture errors retry. Frames are dropped before base64 encoding when a socket already has queued data. JPEG remains the transport format, with 30 fps as the target, not a promised measured rate.

Mobile removes the hidden-image/visible-image decode cycle. A dedicated component decodes one image and retains just one pending image, replacing it when a newer frame arrives. Frame contents no longer update the large app component. VNC runs only while its tab is foregrounded. Touch handling uses the current socket and measured image viewport, instead of initial stale state and a second delayed click handler.

The deterministic scheduler tests show that the first frame is delivered without advancing through a 100 ms timer. This removes that **artificial delay**; it is not an end-to-end latency benchmark. Native capture, Jimp encoding, base64 overhead, network latency, and device decoding remain. Measure touch-to-paint p50/p95 on physical iOS and Android devices over direct Tailscale and a TLS proxy before claiming a latency percentage.

## Keyboard changes

The old length-based live input sent only appended characters. Backspace, replacements, cursor edits, and IME composition could diverge from the desktop. The new text composer keeps native edits local; **Send** inserts the complete draft and clears it only if the socket accepts the send. **Enter** remains a separate remote key, avoiding an accidental command execution when sending a draft. Paste, multiline text, and Unicode are preserved at the transport boundary; the host's RobotJS/OS still determines Unicode injection support.

Special keys remain immediate. Hoisted key components retain identity across pressed-state renders, so held-key repeat can stop on release. Repeat timers stop on blur, backgrounding, and unmount. Smart-quote normalization now matches curly quotation marks. Hardware keyboard forwarding and full IME-to-desktop live composition remain separate future features.

## Dependency audit

Counts are npm audit's affected package counts, including transitive parent packages, not counts of independent exploits.

| Repository | Before | After |
| --- | --- | --- |
| AirCodum extension | 30 (1 critical, 8 high, 21 moderate) | 0 |
| Agentum CLI | Not recorded before updates | 0 |
| Mobile | 41 (2 critical, 21 high, 17 moderate, 1 low) | 13 (8 high, 5 moderate) |

Compatible updates were applied. Agentum uses Node's `randomUUID` instead of the vulnerable older UUID package. Mobile pins compatible patched PostCSS and UUID transitive versions. The mobile iOS/Android build-number edits and unrelated presentation file predated this work and are preserved.

**Remaining mobile findings:**

1. `image-size` accounts for eight high findings through Metro/Expo parent packages. The installed parser is used by build tooling for image assets. The registry's latest release is 2.0.2, which remains affected by ICNS/JXL/HEIF infinite-loop advisories. Remediation needs an upstream fix or a reviewed parser replacement/backport in Metro/Expo, with malformed-image regression fixtures. An Expo major bump alone is not evidence this is fixed. Avoid feeding untrusted images to the build pipeline pending that work. See [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
2. `decode-uri-component` accounts for five moderate findings through query-string/navigation/router. Version 0.5.0 fixes malformed-percent-input CPU exhaustion, but changes the module to ESM; the existing query-string consumer uses CommonJS. Complete remediation requires a compatible query-string/navigation migration or a reviewed CommonJS backport, plus malformed deep-link and routing tests on device. A blind override would change the function shape consumed by that code. See the [upstream advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

Allow a focused dependency migration and native build/test pass for these remaining items. The exact effort depends on whether upstream patches become available. No blanket `npm audit fix --force` or whole Expo major migration was applied.

## Validation and remaining release work

- Extension TypeScript check and esbuild/native-addon packaging pass.
- Agentum TypeScript build passes.
- Mobile TypeScript check passes, including fixes to pre-existing speech-event and notification type errors.
- Fourteen targeted tests cover real upgrade rejection, payload limits, native input validation, both actual server integrations, on-demand streaming, malformed text, listener release, scheduler timing/recovery/cancellation, keyboard composition/repeat, transport validation, and newest-frame decoding.
- Final iOS and Android JavaScript/Hermes bundle exports pass. These are separate from a native app build.
- No physical-device test, store build, security penetration test, or deployment was performed.
- The app intentionally has `newArchEnabled: false`; Reanimated stays on compatible major 3. Expo's generic version checker prefers major 4, which requires a separate new-architecture migration. This is an existing architecture constraint.
- SecureStore adds a native module: regenerate/rebuild native projects (or install iOS pods) before running the updated app. Expo Go/export success alone does not update an already-installed custom client.
- Review remaining upload lifetime/disk quotas, image decompression limits, token rotation UX, session retention, and long-running output memory limits before an internet-facing production release. Paired devices retain full desktop/terminal authority by design.

See `CONNECTION_SETUP.md` for the new pairing and transport requirements. Webview restrictions follow [VS Code's guidance](https://code.visualstudio.com/api/extension-guides/webview#security); current ws updates were checked against the [upstream advisories](https://github.com/websockets/ws/security/advisories).
