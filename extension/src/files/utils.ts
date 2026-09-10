import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { isText } from "istextorbinary";
import { store } from "../state/store";
import { resizeImage } from "../utils";
import { getApiKey } from "../ai/utils";
import WebSocket from "ws";
import { transcribeImage } from "../ai/api";

/**
 * Save the incoming files and commands to the workspace.
 * Creates a AirCodum folder in the workspace if it doesn't exist.
 * Stores incoming files in this folder.
 * @param fileBuffer
 * @returns
 */
export async function saveFile(fileBuffer: Buffer): Promise<{
  fileName: string;
  fileType: string;
  content: string;
  filePath: string;
}> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("No workspace folder open");
  }

  if (fileBuffer.length > 8 * 1024 * 1024) throw new Error("File too large");
  const codeDropFolder = path.join(workspaceFolder.uri.fsPath, "AirCodum");
  if (!fs.existsSync(codeDropFolder)) {
    fs.mkdirSync(codeDropFolder);
  }

  if (fs.lstatSync(codeDropFolder).isSymbolicLink()) throw new Error("Upload folder cannot be a symbolic link");
  const fileType: MessageType = determineFileType(fileBuffer);
  const fileExtension = getFileExtension(fileBuffer, fileType);
  const fileName = `file_${randomUUID()}${fileExtension}`;
  const filePath = path.join(codeDropFolder, fileName);

  try {
    if (!fs.existsSync(codeDropFolder)) {
      fs.mkdirSync(codeDropFolder);
    }
    fs.writeFileSync(filePath, fileBuffer, { flag: "wx", mode: 0o600 });
  } catch (error) {
    console.error("File operation error:", error);
    throw new Error("Failed to save the file");
  }
  vscode.window.showInformationMessage(`File saved: ${fileName}`);

  const content =
    fileType === "image"
      ? fileBuffer.toString("base64")
      : fileBuffer.toString("utf-8");

  const currentContext = store.getState().currentContext;

  currentContext.messageType = fileType;
  if (fileType === "image") {
    const resizedImageBuffer = await resizeImage(filePath, 800);
    currentContext.image = resizedImageBuffer.toString("base64");
  } else {
    currentContext.message = content;
  }
  return { fileName, fileType, content, filePath };
}

/**
 * Determine the type of the file based on its content.
 * @param buffer
 * @returns
 */
function determineFileType(buffer: Buffer): MessageType {
  if (isImage(buffer)) {
    return "image";
  } else if (isText(null, buffer)) {
    // Additional logic to determine if it's code or plain text
    const fileContent = buffer.toString();
    if (/function|import|class/.test(fileContent)) {
      return "code";
    }
    return "text";
  }
  return "binary";
}

function isImage(buffer: Buffer): boolean {
  const fileSignature = buffer.toString("hex", 0, 4).toUpperCase();
  return (
    fileSignature.startsWith("89504E47") || // PNG
    fileSignature.startsWith("FFD8FF") || // JPEG
    fileSignature.startsWith("47494638") // GIF
  );
}

function getFileExtension(buffer: Buffer, fileType: MessageType): string {
  if (fileType === "image") {
    const fileSignature = buffer.toString("hex", 0, 4).toUpperCase();
    if (fileSignature.startsWith("89504E47")) return ".png";
    if (fileSignature.startsWith("FFD8FF")) return ".jpg";
    if (fileSignature.startsWith("47494638")) return ".gif";
  }
  switch (fileType) {
    case "text":
      return ".txt";
    case "code":
      return ".code";
    default:
      return ".bin";
  }
}

/**
 * Handle files sent by the app.
 * If the file is an image, transcribe it using OpenAI.
 * @param fileBuffer
 * @param ws
 * @returns
 */
export async function handleFileUpload(fileBuffer: Buffer, ws: WebSocket) {
  const panel = store.getState().webview.panel;
  try {
    const fileInfo = await saveFile(fileBuffer);
    panel?.webview.postMessage({
      type: "file",
      ...fileInfo,
    });

    const apiKey = getApiKey();
    if (!apiKey) {
      panel?.webview.postMessage({
        type: "error",
        message: "OpenAI API key not found. Please enter your API key.",
      });
      return;
    }

    if (fileInfo.fileType === "image") {
      const transcription = await transcribeImage(fileInfo.content, apiKey);
      panel?.webview.postMessage({
        type: "transcription",
        text: transcription,
      });
    }
  } catch (error: any) {
    panel?.webview.postMessage({
      type: "error",
      message: "Error processing file: " + error.message,
    });
  }
}
