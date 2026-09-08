# Automatic compatibility

No rollout flags or manual feature switches are used. New servers send an additive `server_capabilities` WebSocket message **after authentication**, before initial session lists or VNC traffic. Existing protocol messages remain supported.

```json
{
  "type": "server_capabilities",
  "protocolVersion": 1,
  "features": {
    "agents": ["claude", "copilot", "codex"],
    "pty": true,
    "vnc": true,
    "vncSharedPort": false,
    "vncPort": 11043,
    "vncStreamControl": true,
    "vncTextInput": true
  }
}
```

The extension advertises no agent/PTY support and `vncSharedPort: true`. Agentum advertises VNC only when its VNC listener starts successfully. Version 1's `vnc` capability includes pointer and special-key events; text insertion and start/stop support are separate flags. Missing flags default to disabled. Unsupported protocol versions enable no features. Capability announcements describe supported APIs, not whether external agent executables are installed or configured.

The mobile app:

- Filters mode/provider tabs and text controls to supported features.
- Uses the main port automatically for extension VNC. For separate listeners, an explicit advanced VNC port wins; otherwise a valid advertised port is used for direct private connections, or the existing next-port convention for TLS. A reverse proxy can still need an external-port override. The server cannot redirect the app to another host or downgrade TLS.
- Identifies older Agentum providers from their unsolicited session lists and older extensions from their existing `screen-update` messages. No speculative session/capability requests are sent: old extensions can mistake unknown JSON for file uploads.
- Reuses the main socket for an old extension's automatic stream and translates pointer/special-key messages to `mouse-event`/`keyboard-event`. It does not send unsupported start/stop/text commands. Those servers cannot provide on-demand capture or the new text composer until updated.
- Allows an empty token for old servers on the already permitted transports. Supplying a token always sends it; a failed authenticated connection is never retried anonymously. Android HTTP 401/403 failures, including statuses in `close.reason`, stop retries and show a pairing prompt.
- Re-detects features on every connection. Existing loopback/Tailscale connections without a saved TLS preference retain their permitted transport. Public/ordinary LAN plaintext addresses remain blocked.

## Compatibility boundary

Automatic feature selection does not manufacture credentials for old mobile binaries. An old unauthenticated app remains rejected by a new authenticated server. Pairing and supported encrypted/private transport are still required for the secured stack. This change does not add an anonymous-access flag to either server or eliminate that one-time app/server migration requirement.

## Validation

The mobile unit suite covers modern/legacy/unknown announcements, disabled features, port selection, legacy wire mapping, empty-token headers and authentication-error classification. Server integration tests verify announcements occur on authenticated sockets and reflect the extension topology or disabled VNC listener.

`tests/android-vnc-e2e.py` in mobile exercises the actual Agentum server and native macOS input from Android, including bad-token rejection followed by successful pairing and exact desktop text/newline assertions.

`tests/android-compatibility-e2e.py` in mobile uses the native Android app with controlled protocol fixtures (`tests/compatibility-fixture.cjs`) for legacy extension, modern extension topology and partial Agentum capabilities. These fixtures expose no desktop/agent functionality; they test mobile routing/feature selection, not complete legacy backend behavior. iOS/full VS Code-host compatibility and old server native bugs remain outside this validation.
