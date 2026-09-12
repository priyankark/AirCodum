# AirCodum 2.4.0: Google Play review setup

AirCodum (`com.codeair`, Android version code 28) is a companion remote control
for the AirCodum **VS Code extension**. It is not the separate Agentum app.
The initial screen asks for the computer's server address and a locally generated
pairing token. There is no AirCodum online account, username, password, subscription,
registration, or one-time login code. Desktop setup is required.

## Videos previously provided with AirCodum

- [AirCodum Pairing Demo](https://youtu.be/KD4TcKLSmMc) — the video linked in the
  existing store review notes.
- [AirCodum: Control VS Code right from your phone!](https://youtu.be/HXtH_NYY2Lc)
  — the demo linked in the extension documentation.

The steps below describe the current 2.4.0 app / 0.2.1 extension pairing process.

## Install the published extension

1. Install [Visual Studio Code](https://code.visualstudio.com/) on a computer.
2. Open Extensions and search for `priyankark.aircodum-app`, or open its
   [published Marketplace page](https://marketplace.visualstudio.com/items?itemName=priyankark.aircodum-app).
3. Select **Install** or update the extension. Confirm stable version **0.2.1**.
   If using the pre-release channel, **Switch to Release Version** is also available.
   Alternatively, install the [published 0.2.1 VSIX](https://github.com/priyankark/AirCodum/releases/tag/v0.2.1)
   using **Extensions: Install from VSIX**.
4. Open a disposable folder in VS Code and trust that folder. Create and open
   `review.txt` containing sample text. Keep VS Code and that editor in front
   when testing desktop input.
5. On macOS, allow **Screen Recording** and **Accessibility** for VS Code in
   System Settings → Privacy & Security. Relaunch VS Code if requested.
6. Leave `aircodum.bindAddress` at its default, `127.0.0.1`, for the emulator/USB
   setup below. Run **Start AirCodum Server** from the Command Palette, then
   **AirCodum: Copy Pairing Token**. Keep that generated token private.

## Android emulator or USB-connected Android device

This path does not require a VPN, Tailscale account, public server or hosted demo
account. It uses Android's standard ADB port forwarding to the review computer.

1. Run the submitted **AirCodum 2.4.0 / build 28** on an Android emulator on the
   same computer, or on a USB-connected Android test device with USB debugging
   authorized for that computer.
2. With [Android SDK Platform-Tools](https://developer.android.com/tools/releases/platform-tools)
   available, run:

   ```sh
   adb devices
   adb reverse tcp:11040 tcp:11040
   ```

   If multiple Android devices are attached, add `-s <device-serial>` after `adb`.
3. In AirCodum enter:

   | Field | Value |
   | --- | --- |
   | Server address | `127.0.0.1` |
   | Port | `11040` |
   | Transport | **Tailscale / localhost (ws)** |
   | Server pairing token | Paste the token copied from the desktop extension |

4. Tap **Connect**. The token authorizes only this desktop; there is no fixed
   developer-controlled account password. It remains valid across normal server
   restarts, and the app saves it in secure storage.

## Feature walkthrough

- In command mode, send **Select All**, then **Move Cursor to End**, and confirm
  the selection/cursor changes in the open VS Code document.
- Open **VNC mode**. Confirm the real desktop appears, then try pointer movement
  and clicks. Desktop input acts on the currently focused application.
- Open the keyboard. Type and edit a draft locally. **Send** inserts that draft
  into the desktop editor; **Enter** is a separate remote key. Use Cmd shortcuts
  on macOS and Ctrl shortcuts on Windows/Linux.
- Try sending a sample text file or image using the app's transfer controls.
  Received content goes to the connected desktop's workspace.
- Background and reopen AirCodum, then reconnect. Stop/restart the extension
  server and reconnect with the same pairing token.
- Camera and microphone/speech permissions are optional for VNC and keyboard.
  Dictation uses the device speech service. Optional AI/OCR uses the provider key
  configured in the extension webview; no developer-owned provider account/key
  is supplied. Basic desktop control does not require a provider key or purchase.

For review evidence, full native Android-emulator and iOS-simulator E2E passed
against the packaged 0.2.0 VSIX in real VS Code 1.121.0. This covered pairing,
editor commands, VNC keyboard drafting/Send/Enter, background/foreground and
server restart/reconnect. Other workflows above are setup instructions, not
claims of completed E2E coverage. See [native validation](NATIVE_VALIDATION.md).

## Remote connection alternative

For an existing Tailscale network, put the computer and phone on that network,
set VS Code's `aircodum.bindAddress` to the computer's Tailscale IP **before**
starting the server, and use that IP, port 11040, the copied token, and
**Tailscale / localhost (ws)** in the app. A public TLS reverse proxy can also
forward to the loopback server; select **TLS (wss)** and its trusted hostname/port.
With extension 0.2.6 and mobile 2.4.2, you can instead choose Local Wi-Fi / Ethernet and connect using the displayed private LAN IP on the same network. Local traffic is unencrypted and intended for trusted networks. Public plaintext addresses remain blocked. See [connection setup](CONNECTION_SETUP.md).
