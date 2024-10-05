# CodeAir: Remote Control VS Code using your smartphone!

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Getting Started](#getting-started)
5. [Features](#features)
6. [Using CodeAir](#using-codeair)
7. [Command Reference](#command-reference)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)
10. [Contributing](#contributing)

## Introduction

CodeAir is your intelligent smpartphone companion for Visual Studio Code! CodeAir bridges the gap between your devices and your development environment, offering seamless file transfer, AI-powered coding assistance, and intuitive commanding over your VS Code instance, right from your smartphone!

## Installation

### VS Code Extension
1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "CodeAir"
4. Click "Install"
5. Reload VS Code when prompted

### Android App
Download the "CodeAir" app from the Android Play Store.
(Current Status: Yet to be published)

## Demo
Check out this demo to understand how to use CodeAir: [CodeAir YouTube Demo](https://www.youtube.com/watch?v=DRAhUfEvJDs&t=167s)

## Configuration

### Setting up the OpenAI API Key

1. Obtain an API key from OpenAI (https://openai.com/)
2. In VS Code, open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Type "CodeAir: Open Webview" and select it
4. In the CodeAir interface, enter your API key in the "OpenAI API Key" field
5. Click "Save Key"

### Customizing the Port (Optional)

1. Go to File > Preferences > Settings (Ctrl+, or Cmd+,)
2. Search for "CodeAir"
3. Find the "Port" setting and change it to your desired port number
4. The default port is 5000

## Getting Started

1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "CodeAir: Start CodeAir Server" and select it
3. CodeAir will display an IP address and port
4. Use any WebSocket client on your other devices to connect to this address

## Features

- **Seamless File Transfer**: Send files from your phone or tablet directly to VS Code
- **AI-Powered Chat**: Get coding help, explanations, and suggestions
- **Image Analysis**: Send images from your smartphone to the VS Code instance and use AI for text extraction or analysis
- **Smart Commands**: Control VS Code using natural language. 800+ commands supported.
- **Screen Capture**: Take screenshots of your development environment and get them sent to your CodeAir app.

## Using CodeAir

### Opening the CodeAir Interface

1. Open the Command Palette
2. Type "CodeAir: Open CodeAir Webview" and select it

### Transferring Files

1. Connect to the CodeAir server from your device
2. Send any file through the WebSocket connection
3. The file will appear in your VS Code workspace under the "CodeAir" folder

### Using AI Chat

1. In the CodeAir interface, find the "Chat with AI" section
2. Type your question or request related to the recently sent files.
3. Click "Send" or press Enter
4. View the AI's response in the interface

### Using Smart Commands

Type commands in the chat input to control VS Code. For example:
- `type Hello, World!`: Types the text in your editor
- `go to line 42`: Moves the cursor to line 42
- `search TODO`: Searches for "TODO" in the current file
- 800+ commands supported (list available at [codeair.app](https://www.codeair.app) ).
- Request new commands by raising an Issue right here.

### Capturing Screenshots

1. Type "get screenshot" in the chat input
2. CodeAir will capture and display your current screen
3. You can then ask the AI to analyze the screenshot

### Working with Images

1. Upload an image file using the file transfer method
2. CodeAir will automatically transcribe any text found in the image
3. The transcribed text will appear in the "Transcription" section of the interface
4. You can copy the transcription to the clipboard or add it to the current file

## Command Reference

Extension Commands:
- `CodeAir: Start CodeAir Server`: Starts the CodeAir server
- `CodeAir: Stop CodeAir Server`: Stops the CodeAir server
- `CodeAir: Open CodeAir Webview`: Opens the CodeAir interface

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

- The CodeAir server operates on your local network. Use caution when using it on public networks.
- Your OpenAI API key is stored locally. Never share this key or commit it to version control.
- Be mindful when executing commands from external devices, as they have control over your VS Code instance.
- Regularly update CodeAir and VS Code to ensure you have the latest security patches.
- Review files received through CodeAir before opening or executing them.

## Troubleshooting

- **Can't start the server**: Make sure no other application is using the same port. Try changing the port in settings.
- **Can't connect from other devices**: Ensure all devices are on the same network. Check if any firewall is blocking the connection.
- **AI features not working**: Verify that you've entered a valid OpenAI API key in the settings.
- **File transfer issues**: Check if your WebSocket client is correctly configured to connect to the CodeAir server address.
- **Extension not loading**: Try uninstalling and reinstalling the extension. Ensure your VS Code is up to date.

If you encounter persistent issues, please check our GitHub repository for known issues or to report a new one.

## Contributing

We welcome contributions to CodeAir Documentation! Here's how you can help:

1. Fork this repository on GitHub
2. Create a new branch for your feature or bug fix
3. Commit your changes with clear, descriptive messages
4. Push the branch and open a pull request

Please ensure your code adheres to the existing style and passes all tests.

For major changes, please open an issue first to discuss the proposed changes.

Thank you for using CodeAir - happy coding!