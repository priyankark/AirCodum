# AirCodum: Smartphone powered Remote Control for VS Code

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Getting Started](#getting-started)
5. [Features](#features)
6. [Using AirCodum](#using-aircodum)
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

### Links
1.) [Extension in Open VSX](https://open-vsx.org/extension/priyankark/aircodum-app)
2.) [VS Code Marketplace Link](https://marketplace.visualstudio.com/items?itemName=priyankark.aircodum-app)

### Android App (free)
Download the "AirCodum" app from the Android Play Store from [Google Play Store link](https://play.google.com/store/apps/details?id=com.codeair)

### iOS App (paid)
Download the "AirCodum" app from the App Store: [iOS App Store link](https://apps.apple.com/in/app/aircodum/id6736912465)

## Demo
Check out this demo to understand how to use AirCodum: [AirCodum YouTube Demo](https://www.youtube.com/watch?v=DRAhUfEvJDs&t=167s)

## Configuration

### Setting up the OpenAI API Key

1. Obtain an API key from OpenAI (https://openai.com/)
2. In VS Code, open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Type "AirCodum: Open Webview" and select it
4. In the AirCodum interface, enter your API key in the "OpenAI API Key" field
5. Click "Save Key"

### Customizing the Port (Optional)

1. Go to File > Preferences > Settings (Ctrl+, or Cmd+,)
2. Search for "AirCodum"
3. Find the "Port" setting and change it to your desired port number
4. The default port is 11040

## Getting Started

1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "AirCodum: Start AirCodum Server" and select it
3. AirCodum will display an IP address and port
4. Use any WebSocket client on your other devices to connect to this address

## Features

- **Seamless File Transfer**: Send files from your phone or tablet directly to VS Code
- **AI-Powered Chat**: Get coding help, explanations, and suggestions
- **Image Analysis**: Send images from your smartphone to the VS Code instance and use AI for text extraction or analysis
- **Smart Commands**: Control VS Code using natural language. 800+ commands supported.
- **Screen Capture**: Take screenshots of your development environment and get them sent to your AirCodum app.
- **VNC Support**: Remote desktop functionality allowing you to view and control your VS Code instance in real-time through your smartphone.

## VNC Support

AirCodum includes VNC (Virtual Network Computing) capabilities, enabling real-time remote desktop functionality:

### Setting up VNC

1. In VS Code, open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "AirCodum: Start VNC Server" and select it
3. The VNC server will start on a default port (typically 5900)
4. The connection details will be displayed in the VS Code status bar

### Using VNC from Your Smartphone

1. Open the AirCodum app on your smartphone
2. Navigate to the VNC section
3. Enter your computer's IP address and the VNC port
4. Connect to view your VS Code instance in real-time
5. Use touch gestures to control your VS Code:
   - Single tap for click
   - Custom keyboard available for typing and controlling
   - Voice support!

### VNC Security

- Use over local, trusted network only!

### VNC Performance Tips

- Ensure both devices are on the same network for optimal performance
- Use landscape mode on your smartphone for better viewing
- Consider reducing VS Code's UI scaling for better visibility on mobile

## Using AirCodum

### Opening the AirCodum Interface

1. Open the Command Palette
2. Type "AirCodum: Open AirCodum Webview" and select it

### Transferring Files

1. Connect to the AirCodum server from your device
2. Send any file through the WebSocket connection
3. The file will appear in your VS Code workspace under the "AirCodum" folder

### Using AI Chat

1. In the AirCodum interface, find the "Chat with AI" section
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
- `get screenshot`: Captures a screenshot

VS Code Commands (examples):
- `Toggle Zen Mode`: Enters or exits Zen Mode
- `Format Document`: Formats the current document
- `Toggle Line Comment`: Comments or uncomments the selected lines
- `Rename Symbol`: Initiates renaming of a symbol
- `Go to Definition`: Navigates to the definition of a symbol
- `Find All References`: Finds all references of a symbol

## Security Considerations

- The AirCodum server operates on your local network. Use caution when using it on public networks.
- Ideally avoid using this system over untrusted public networks (say Airport WiFi)
- Your OpenAI API key is stored locally. Never share this key or commit it to version control.
- Be mindful when executing commands from external devices, as they have control over your VS Code instance.
- Regularly update AirCodum and VS Code to ensure you have the latest security patches.
- Review files received through AirCodum before opening or executing them.
- Note: The system doesn't yet support WSS (WebSockets over HTTPS).

## Troubleshooting

- **Can't start the server**: Make sure no other application is using the same port. Try changing the port in settings.
- **Can't connect from other devices**: Ensure all devices are on the same network. Check if any firewall is blocking the connection.
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

Thank you for using AirCodum - happy coding!

### **Notice** 
This project had a name change from "CodeAir" to "AirCodum"

### As seen on:
* [Hacker News](https://news.ycombinator.com/item?id=41749567)
* [Product Hunt](https://www.producthunt.com/products/codeair#aircodum)
