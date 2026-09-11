## Scan to connect

With AirCodum mobile 2.4.2 or later, choose **Local Wi-Fi / Ethernet** for devices on the same network, or **Tailscale** for remote access and open **Connection → QR code → Show QR code**. Tap **Scan QR to connect** on Android or iOS. The scan fills host, port, transport and pairing key and connects. Use **Enter manually** for host, port, connection method, and **Copy pairing key**.

**Keep Mac awake** prevents idle sleep while the server is running. It does not override macOS lid-close sleep. For supported closed-display use, connect power, an external display, and a keyboard and mouse. The mobile app retries when the desktop becomes reachable again.

## Connect your phone

Open **AirCodum Webview**. The **Connection** tab shows the server address and connection status, with **QR code** and **Enter manually** pairing options. Expand **Server settings & troubleshooting** to change the connection address, start or stop the server, set **Keep Mac awake**, or open the connection log. The **Files & AI** tab holds received content and the optional AI assistant.

# AirCodum: Smartphone powered Remote Control for VS Code

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Getting Started](#getting-started)
5. [Features](#features)
6. [Using AirCodum](#using-aircodum)
   - [Remote Access using Tailscale](#remote-access-using-tailscale)
7. [Command Reference](#command-reference)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)
10. [Contributing](#contributing)

## Introduction

AirCodum is your intelligent smartphone companion for Visual Studio Code! AirCodum bridges the gap between your devices and your development environment, offering seamless file transfer, AI-powered coding assistance, and intuitive commanding over your VS Code instance, right from your smartphone!

## Installation

### VS Code Extension
1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "AirCodum"
4. Click "Install"
5. Reload VS Code when prompted

### Android App (free)
Download the "AirCodum" app from the Android Play Store: [Google Play Store link](https://play.google.com/store/apps/details?id=com.codeair&hl=en)

### iOS App (paid)
Download the "AirCodum" app from the App Store: [iOS App Store link](https://apps.apple.com/in/app/aircodum/id6736912465)

## Demo
Check out this demo to understand how to use AirCodum: [AirCodum YouTube Demo](https://www.youtube.com/watch?v=HXtH_NYY2Lc&t=98s)

## Configuration

### Setting up the OpenAI API Key

1. Obtain an API key from OpenAI (https://openai.com/)
2. In VS Code, open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Type "AirCodum: Open Webview" and select it
4. Open **Files & AI → AI assistant → Set up AI**, then enter your API key.
5. Click **Save key**. An API key is optional and is not needed for phone pairing.

### Pairing and transport

This release requires a pairing-capable build of the original **AirCodum app (`com.codeair`)**. Agentum is a separate product. Install the updated mobile app before switching to this extension release. Old mobile builds can continue using the previous extension; they cannot authenticate to this secured listener.

The listener uses port **11040** for commands, files and VNC. It defaults to localhost. Choose a detected private LAN address for same-network use, a Tailscale address for remote use, or leave localhost behind a TLS reverse proxy. Public and wildcard binds are rejected. Local Wi-Fi requires mobile 2.4.2 and uses unencrypted traffic; use a network you trust. Pairing remains required.

## Getting Started

1. Open a trusted VS Code workspace and run **Start AirCodum Server** from the Command Palette.
2. Run **AirCodum: Copy Pairing Token** and paste the token into the mobile app's connection settings. Keep it private: it authorizes desktop control.
3. Choose **Local Wi-Fi / Ethernet** in the extension for same-network access. Enter the displayed private IP and port 11040 in the phone; **Local Wi-Fi** selects automatically. On iOS, allow Local Network access. Alternatively, choose **Tailscale** on both devices for remote access, or **Custom TLS server** for your configured TLS proxy.
4. Connect. The app selects supported features automatically; no rollout flags are needed.
5. Open VNC to stream the desktop. Compose text locally, then press **Send** to insert it. **Enter** is a separate remote key. On macOS, grant screen-recording and accessibility permissions to the VS Code host.

## Features

- **Seamless File Transfer**: Send files from your phone or tablet directly to VS Code
- **AI-Powered Chat**: Get coding help, explanations, and suggestions
- **Image Analysis**: Send images from your smartphone to the VS Code instance and use AI for text extraction or analysis
- **Smart Commands**: Control VS Code using natural language. 800+ commands supported.
- **Screen Capture**: Take screenshots of your development environment and get them sent to your AirCodum app.
- **VNC Mode**: Control your VS Code instance visually through your smartphone's screen, just like a remote desktop.

### VNC Mode

VNC Mode allows you to control VS Code directly through your smartphone's screen, providing a remote desktop-like experience:

1. **Enabling VNC Mode**:
   - In your AirCodum mobile app, tap the "VNC Mode" button in the bottom navigation
   - Your VS Code screen will start streaming to your phone in real-time

2. **Interacting with VS Code**:
   - Tap anywhere on the screen to move the cursor
   - Use the custom keyboard integarted in the app to type
   - Use voice on your phone to code!

3. **Performance Tips**:
   - Ensure both devices are on the same network for best performance
   - Use landscape mode on your phone for a better view
   - Consider disabling VNC Mode when not needed to save resources

## Using AirCodum

### Opening the AirCodum Interface

1. Open the Command Palette
2. Type "AirCodum: Open AirCodum Webview" and select it

### Transferring Files

1. Connect to the AirCodum server from your device
2. Send any file through the WebSocket connection
3. The file will appear in your VS Code workspace under the "AirCodum" folder

### Using AI Chat

1. In the AirCodum interface, open **Files & AI → AI assistant**
2. Type your question or request related to the recently sent files.
3. Click "Send" or press Enter
4. View the AI's response in the interface

### Using Smart Commands

Type commands in the chat input to control VS Code. For example:
- `type Hello, World!`: Types the text in your editor
- `go to line 42`: Moves the cursor to line 42
- `search TODO`: Searches for "TODO" in the current file
- 800+ commands supported (list available at [aircodum.com](https://www.aircodum.com) ).
- Request new commands by raising an Issue right here.

### Capturing Screenshots

1. Type "get screenshot" in the chat input
2. AirCodum will capture and display your current screen
3. You can then ask the AI to analyze the screenshot

### Working with Images

1. Upload an image file using the file transfer method
2. AirCodum will automatically transcribe any text found in the image
3. The transcribed text will appear in the "Transcription" section of the interface
4. You can copy the transcription to the clipboard or add it to the current file

### Remote Access using Tailscale

Tailscale enables secure remote access to your AirCodum server from anywhere:

1. Install Tailscale on both your computer and mobile device:
   - Computer: Visit [Tailscale Downloads](https://tailscale.com/download)
   - Mobile: Install from your device's app store

2. Set up Tailscale:
   - Create a Tailscale account if you don't have one
   - Sign in on both devices
   - They will automatically connect to your Tailscale network

3. Set `aircodum.bindAddress` to your desktop's Tailscale IP and restart the AirCodum server.
4. Enter that IP, port 11040 and the pairing token in the app, then select **Tailscale**. Plaintext hostnames are not accepted; use the actual Tailscale IP or TLS.

## Command Reference

Extension Commands:
- `AirCodum: Start AirCodum Server`: Starts the AirCodum server
- `AirCodum: Stop AirCodum Server`: Stops the AirCodum server
- `AirCodum: Open AirCodum Webview`: Opens the AirCodum interface

Chat-based Commands:
- `type [text]`: Types the specified text
- `type [text] and enter`: Types the text and presses Enter
- `keytap [key]`: Simulates pressing a key (e.g., enter, tab, escape)
- `go to line [number]`: Moves to a specific line
- `open file [filename]`: Opens a file
- `search [text]`: Searches in the current file
- `replace [old] with [new]`: Replaces text

VS Code Commands (examples):
- `Toggle Zen Mode`: Enters or exits Zen Mode
- `Format Document`: Formats the current document
- `Toggle Line Comment`: Comments or uncomments the selected lines
- `Rename Symbol`: Initiates renaming of a symbol
- `Go to Definition`: Navigates to the definition of a symbol
- `Find All References`: Finds all references of a symbol

## Security Considerations

- Pairing is required before commands, uploads or native input are accepted. Tokens and OpenAI keys are stored in VS Code SecretStorage.
- Local Wi-Fi is unencrypted and intended for trusted networks. For encrypted access, use an actual Tailscale connection or a TLS proxy. A pairing token authenticates a device; it does not encrypt plain WebSocket traffic by itself.
- Paired devices can control your desktop. Review received files before opening or executing them.
- VNC capture runs only for subscribers, with bounded messages and newest-frame backpressure. Leaving VNC stops that subscription.
- API keys previously placed in workspace `.env` files are no longer read. Re-enter the key in the webview. Existing files are untouched.

## Troubleshooting

- **Can't start the server**: Make sure no other application is using the same port. Stop the other listener using port 11040 before starting AirCodum.
- **Can't connect from other devices**: Check the pairing token, selected address and firewall. Local Wi-Fi requires both devices on the same network, mobile 2.4.2, iOS Local Network permission, and a router that allows devices to communicate. Guest Wi-Fi may isolate clients.
- **AI features not working**: Verify that you've entered a valid OpenAI API key in the settings.
- **File transfer issues**: Check if your WebSocket client is correctly configured to connect to the AirCodum server address.
- **Extension not loading**: Try uninstalling and reinstalling the extension. Ensure your VS Code is up to date.

If you encounter persistent issues, please check our GitHub repository for known issues or to report a new one.

## Contributing

We welcome contributions to AirCodum Documentation! Here's how you can help:

1. Fork this repository on GitHub
2. Create a new branch for your changes
3. Commit your changes with clear, descriptive messages
4. Push the branch and open a pull request
5. Maintainers will test the .vsix package created from your branch and merge your PR.

## Ideas for Contributions
Following is not an exhaustive list:
- Unit test infrastructure.
- GitHub actions support for CI/CD.
- Add more commands and help clean up existing ones.

## Support
- Please raise issues on the associated GitHub repo for triaging.
- For urgent requests, you may email the developer at priyankar.kumar98@gmail.com

**Note:** 
This project was earlier called "CodeAir" and is now being renamed to "AirCodum."

### As seen on:
* [Hacker News](https://news.ycombinator.com/item?id=41749567)
* [Product Hunt](https://www.producthunt.com/products/codeair#aircodum)

Thank you for using AirCodum - happy coding!
