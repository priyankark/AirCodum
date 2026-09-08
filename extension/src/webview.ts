import * as vscode from "vscode";
import { getApiKey, saveApiKey } from "./ai/utils";
import { setWebviewPanel } from "./state/actions";
import { handleChat } from "./ai/api";

import { randomBytes } from "crypto";

function getWebviewContent(): string {
  const nonce = randomBytes(24).toString("hex");
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AirCodum</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #1e1e1e;
            color: #d4d4d4;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: #252526;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
        }
        h1, h2 {
            color: #569cd6;
        }
        input[type="password"], input[type="text"] {
            width: 70%;
            padding: 10px;
            margin-right: 10px;
            background-color: #3c3c3c;
            color: #d4d4d4;
            border: 1px solid #565656;
            border-radius: 4px;
        }
        button {
            padding: 10px 15px;
            background-color: #0e639c;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }
        button:hover {
            background-color: #1177bb;
        }
        #fileContent, #transcription, #chatResponse {
            background-color: #1e1e1e;
            border: 1px solid #3c3c3c;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
            white-space: pre-wrap;
            overflow-x: auto;
        }
        .error {
            color: #f48771;
            background-color: #5a1d1d;
            border: 1px solid #8a2c2c;
            border-radius: 4px;
            padding: 10px;
            margin-top: 20px;
        }
        .logo {
            font-size: 2.5em;
            font-weight: bold;
            color: #569cd6;
            margin-bottom: 10px;
        }
        .tagline {
            font-style: italic;
            color: #9cdcfe;
            margin-bottom: 20px;
        }
        #image {
            max-width: 100%;
            height: auto;
            margin-top: 20px;
            border: 1px solid #3c3c3c;
            border-radius: 4px;
        }
        .status {
            padding: 10px;
            background-color: #3c3c3c;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .status-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .status-value {
            font-weight: bold;
            color: #9cdcfe;
        }
    </style>
  </head>
  <body>
    <div class="container">
        <div class="logo">AirCodum</div>
        <div class="tagline">Airdrop for your Code</div>
        
        <div class="status">
            <div class="status-item">
                <span>IP Address:</span>
                <span id="ipAddress" class="status-value"></span>
            </div>
            <div class="status-item">
                <span>Port:</span>
                <span class="status-value">11040</span>
            </div>
        </div>
        
        <div>
            <h2>OpenAI API Key</h2>
            <input type="password" id="apiKeyInput" placeholder="Enter your OpenAI API key">
            <button data-action="saveApiKey">Save Key</button>
        </div>
        
        <div id="fileContainer" style="display: none;">
            <h2>Received File</h2>
            <div id="fileContent"></div>
            <img id="image" style="display: none;" alt="Received image">
        </div>
        
        <div id="transcriptionContainer" style="display: none;">
            <h2>Transcription</h2>
            <pre id="transcription"></pre>
            <button data-action="copyToClipboard" data-target="transcription">Copy to Clipboard</button>
            <button data-action="addToCurrentFile" data-target="transcription">Add to Current File</button>
        </div>
        
        <div id="chatContainer">
            <h2>Chat with AI</h2>
            <input type="text" id="chatInput" placeholder="Ask about the file or code...">
            <button data-action="chat">Send</button>
            <div id="chatResponse" style="display: none;"></div>
            <button data-action="copyToClipboard" data-target="chatResponse" style="display: none;">Copy to Clipboard</button>
            <button data-action="addToCurrentFile" data-target="chatResponse" style="display: none;">Add to Current File</button>
        </div>
        
        <div id="waitingMessage">
            <p>Waiting for a file to be received...</p>
        </div>
        
        <div id="errorContainer" class="error" style="display: none;"></div>
    </div>
  
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const actions = { saveApiKey, copyToClipboard, addToCurrentFile, chat };
        document.querySelectorAll('[data-action]').forEach(button => {
          button.addEventListener('click', () => actions[button.dataset.action](button.dataset.target));
        });
  
        function saveApiKey() {
            const apiKey = document.getElementById('apiKeyInput').value;
            vscode.postMessage({
                command: 'saveApiKey',
                key: apiKey
            });
            document.getElementById('apiKeyInput').value = '';
        }
  
        function copyToClipboard(elementId) {
            const element = document.getElementById(elementId);
            const text = element.textContent;
            navigator.clipboard.writeText(text)
                .then(() => vscode.postMessage({ command: 'showInfo', message: 'Content copied to clipboard!' }))
                .catch(() => showError('Failed to copy content to clipboard.'));
        }
  
        function addToCurrentFile(elementId) {
            const element = document.getElementById(elementId);
            const text = element.textContent;
            vscode.postMessage({
                command: 'addToCurrentFile',
                text: text
            });
        }
  
        function chat() {
            const chatInput = document.getElementById('chatInput');
            const prompt = chatInput.value;
            if (prompt.trim() === '') return;
  
            vscode.postMessage({
                command: 'chat',
                prompt: prompt
            });
  
            chatInput.value = '';
        }
  
        function showError(message) {
            const errorContainer = document.getElementById('errorContainer');
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
        }
  
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'file':
                    handleFileMessage(message);
                    break;
                case 'transcription':
                    handleTranscriptionMessage(message);
                    break;
                case 'chatResponse':
                    handleChatResponseMessage(message);
                    break;
                case 'ipAddress':
                    document.getElementById('ipAddress').textContent = message.ipAddress;
                    break;
                case 'error':
                    showError(message.message);
                    break;
            }
        });
  
        function handleFileMessage(message) {
            if (message.fileType === 'image') {
                document.getElementById('image').src = 'data:image/png;base64,' + message.content;
                document.getElementById('image').style.display = 'block';
                document.getElementById('fileContent').style.display = 'none';
            } else {
                document.getElementById('transcription').textContent = "";
                document.getElementById('transcriptionContainer').style.display = 'none';
                document.getElementById('fileContent').textContent = message.content;
                document.getElementById('fileContent').style.display = 'block';
                document.getElementById('image').style.display = 'none';
            }
            document.getElementById('fileContainer').style.display = 'block';
            document.getElementById('waitingMessage').style.display = 'none';
        }
  
        function handleTranscriptionMessage(message) {
            document.getElementById('transcription').textContent = message.text;
            document.getElementById('transcriptionContainer').style.display = 'block';
        }
  
        function handleChatResponseMessage(message) {
            document.getElementById('chatResponse').textContent = message.response;
            document.getElementById('chatResponse').style.display = 'block';
            document.querySelectorAll('#chatContainer button').forEach(btn => btn.style.display = 'inline-block');
        }
  
        // Request the API key when the webview loads
        vscode.postMessage({ command: 'ipAddress' });
    </script>
  </body>
  </html>`;
}

export function createWebviewPanel(
  context: vscode.ExtensionContext,
  address: string
) {
  const panel = vscode.window.createWebviewPanel(
    "AirCodum",
    "AirCodum",
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      localResourceRoots: [],
      retainContextWhenHidden: true, // Add this option
    }
  );

  panel.webview.html = getWebviewContent();


  // Send the IP address to the webview
  panel.webview.postMessage({ type: "ipAddress", ipAddress: address });

  // Add this event listener
  panel.onDidDispose(
    () => {
      setWebviewPanel(null);
    },
    null,
    context.subscriptions
  );

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (!message || typeof message.command !== "string") return;
      switch (message.command) {
        case "addToCurrentFile":
          addToCurrentFile(message.text);
          break;
        case "ipAddress":
          panel?.webview.postMessage({ type: "ipAddress", ipAddress: address });
          break;
        case "saveApiKey":
          await saveApiKey(message.key);
          break;
        case "chat":
          if (typeof message.prompt === "string" && message.prompt.length <= 4096) await handleChat(message.prompt, getApiKey());
          break;
        case "showInfo":
          vscode.window.showInformationMessage(message.message);
          break;
      }
    },
    undefined,
    context.subscriptions
  );
  // Set the panel in the store
  setWebviewPanel(panel);
}

function addToCurrentFile(text: string) {
  if (typeof text !== "string" || text.trim() === "") {
    vscode.window.showErrorMessage("Invalid text input.");
    return;
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, text);
    });
  }
}
