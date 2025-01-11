import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import { typedRobot as robot } from './commanding/robotjs-handlers';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { handleCommand } from './commanding/command-handler';
import { chatWithOpenAI } from './ai/api';
import { handleFileUpload } from './files/utils';
import { store } from './state/store';
import {
  addWebSocketConnection,
  removeWebSocketConnection,
} from './state/actions';

import { Commands } from './commanding/commands';

interface VNCQualitySettings {
  width: number;
  jpegQuality: number;
  fps: number;
}

/**
 * Manages screen capture, shared by all clients.
 * This ensures we only capture & process once for all connected clients.
 */
class ScreenCaptureManager {
  private static instance: ScreenCaptureManager;
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private quality: VNCQualitySettings = {
    width: 1280,
    jpegQuality: 80,
    fps: 15,
  };

  // We'll store just one pending screenshot at a time.
  private pendingRawScreenshot: Buffer | null = null;

  // True if we're currently processing a frame
  private processingFrame = false;

  private subscribers: Array<(frame: Buffer, hash: string) => void> = [];
  private screenSize = robot.getScreenSize();

  private constructor() {}

  public static getInstance(): ScreenCaptureManager {
    if (!ScreenCaptureManager.instance) {
      ScreenCaptureManager.instance = new ScreenCaptureManager();
    }
    return ScreenCaptureManager.instance;
  }

  public subscribe(
    callback: (frame: Buffer, hash: string) => void
  ): () => void {
    this.subscribers.push(callback);

    // If no one is capturing, start
    if (!this.isCapturing) {
      this.startCaptureLoop();
    }

    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
      if (this.subscribers.length === 0) {
        this.stopCaptureLoop();
      }
    };
  }

  private startCaptureLoop() {
    if (this.isCapturing) return;
    this.isCapturing = true;

    const frameDuration = 1000 / this.quality.fps;

    // We capture periodically, but process in a separate function
    this.captureInterval = setInterval(async () => {
      try {
        // Capture raw screenshot
        const raw = await screenshot();
        // If we are still processing, discard the old pending
        // and store this new screenshot as the pending one.
        this.pendingRawScreenshot = raw;

        // Attempt to process if not already busy
        this.processNextFrameIfAvailable();
      } catch (error) {
        console.error('Capture error:', error);
      }
    }, frameDuration);
  }

  private stopCaptureLoop() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.isCapturing = false;
  }

  private async processNextFrameIfAvailable() {
    // If we're already processing, return. We'll handle it later when done.
    if (this.processingFrame) return;

    // If there’s no pending screenshot, nothing to do
    if (!this.pendingRawScreenshot) return;

    // Mark that we’re processing
    this.processingFrame = true;

    // Grab the pending screenshot and clear it so that
    // if a new one arrives, it won't overwrite mid-process.
    const rawScreenshot = this.pendingRawScreenshot;
    this.pendingRawScreenshot = null;

    try {
      // 1. Process the image
      const processedImage = await this.processImage(rawScreenshot);

      // 2. Compute hash
      const hash = await this.calculateImageHash(processedImage);

      // 3. Notify subscribers
      this.subscribers.forEach((cb) => cb(processedImage, hash));
    } catch (error) {
      console.error('Error processing frame:', error);
    }

    // Mark done
    this.processingFrame = false;

    // Check if another screenshot arrived while we were busy
    // so we can process the *latest* one immediately.
    if (this.pendingRawScreenshot) {
      // If so, process that now
      this.processNextFrameIfAvailable();
    }
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    const height = Math.floor(
      this.quality.width * (this.screenSize.height / this.screenSize.width)
    );
    return sharp(buffer)
      .resize(this.quality.width, height, {
        fit: 'fill',
        kernel: sharp.kernel.nearest,
      })
      .jpeg({
        quality: this.quality.jpegQuality,
        force: true,
        optimizeScans: true,
        progressive: true,
      })
      .toBuffer();
  }

  private async calculateImageHash(imageBuffer: Buffer): Promise<string> {
    const tiny = await sharp(imageBuffer)
      .resize(16, 16)
      .greyscale()
      .raw()
      .toBuffer();

    const pixels = Array.from(tiny).filter((_, i) => i % 4 === 0);
    return pixels.join(',');
  }

  public updateQualitySettings(quality: Partial<VNCQualitySettings>) {
    if (quality.width !== undefined) {
      this.quality.width = quality.width;
    }
    if (quality.jpegQuality !== undefined) {
      this.quality.jpegQuality = quality.jpegQuality;
    }
    if (quality.fps !== undefined) {
      this.quality.fps = quality.fps;
      if (this.captureInterval) {
        clearInterval(this.captureInterval);
        this.startCaptureLoop();
      }
    }
  }
}


/**
 * Per-connection class that handles the WebSocket for:
 * - Sending frames as they arrive
 * - Handling user input
 * - Handling commands
 */
class VSCodeVNCConnection {
  private unsubscribe: (() => void) | null = null;
  private screenSize = robot.getScreenSize();

  constructor(private ws: WebSocket) {
    this.setupWebSocketHandlers();
    this.subscribeToFrameUpdates();
  }

  private setupWebSocketHandlers() {
    this.ws.on('message', async (message: WebSocket.Data) => {
      // If we receive binary data, parse it as file upload or another protocol
      if (message instanceof Buffer) {
        await this.handleBufferMessage(message);
      } else if (typeof message === 'string') {
        await this.handleStringMessage(message);
      }
    });

    this.ws.on('close', () => {
      this.dispose();
    });
  }

  private async handleBufferMessage(message: Buffer) {
    const messageData = message.toString();
    try {
      const parsedMessage = JSON.parse(messageData);
      switch (parsedMessage.type) {
        case 'mouse-event':
          await this.handleMouseEvent(parsedMessage);
          break;
        case 'keyboard-event':
          await this.handleKeyboardEvent(parsedMessage);
          break;
        case 'quality-update':
          ScreenCaptureManager.getInstance().updateQualitySettings(parsedMessage);
          break;
        default:
          if (this.isSupportedCommand(messageData)) {
            await handleCommand(messageData as never, this.ws);
          } else {
            await handleFileUpload(message, this.ws);
          }
      }
    } catch (error) {
      // If not JSON or parse error, treat as command or file
      if (this.isSupportedCommand(messageData)) {
        await handleCommand(messageData as never, this.ws);
      } else {
        await handleFileUpload(message, this.ws);
      }
    }
  }

  private async handleStringMessage(message: string) {
    try {
      // If it's JSON, check if it matches our known message types
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === 'quality-update') {
        ScreenCaptureManager.getInstance().updateQualitySettings(parsedMessage);
        return;
      }
      // If not recognized JSON, treat it as text for AI chat
      throw new Error('Not recognized JSON');
    } catch {
      // Chat with OpenAI fallback
      try {
        const response = await chatWithOpenAI(
          message,
          store.getState().apiKey || ''
        );
        store.getState().webview.panel?.webview.postMessage({
          type: 'chatResponse',
          response,
        });
      } catch (error: any) {
        store.getState().webview.panel?.webview.postMessage({
          type: 'error',
          message: 'Error chatting with AI',
        });
      }
    }
  }

  private subscribeToFrameUpdates() {
    const manager = ScreenCaptureManager.getInstance();
    // Subscribe to new frames
    this.unsubscribe = manager.subscribe((frame, hash) => {
      // You can send a binary message directly:
      // this.ws.send(frame, { binary: true });
      //
      // Or send JSON with base64 for compatibility:
      const base64Image = frame.toString('base64');
      this.ws.send(
        JSON.stringify({
          type: 'screen-update',
          image: base64Image,
          dimensions: this.getScaledDimensions(),
        })
      );
    });
  }

  private getScaledDimensions() {
    const { width } = ScreenCaptureManager.getInstance()['quality'];
    const { width: realWidth, height: realHeight } = this.screenSize;
    const height = Math.floor(width * (realHeight / realWidth));

    return { width, height };
  }

  private async handleMouseEvent(data: any) {
    try {
      const { x, y, eventType, screenWidth, screenHeight } = data;

      // Convert from client space to actual screen coordinates
      const actualX = Math.floor((x / screenWidth) * this.screenSize.width);
      const actualY = Math.floor((y / screenHeight) * this.screenSize.height);

      robot.moveMouse(actualX, actualY);

      switch (eventType) {
        case 'down':
          robot.mouseToggle('down', 'left');
          break;
        case 'up':
          robot.mouseToggle('up', 'left');
          break;
        case 'move':
          // Already moved above
          break;
      }
    } catch (error) {
      console.error('Error handling mouse event:', error);
    }
  }

  private async handleKeyboardEvent(data: any) {
    try {
      const { key, modifier } = data;
      if (modifier) {
        robot.keyTap(key, modifier);
      } else {
        robot.keyTap(key);
      }
    } catch (error) {
      console.error('Error handling keyboard event:', error);
    }
  }

  private isSupportedCommand(command: string): boolean {
    return (
      Object.keys(Commands)
        .map((e) => e.toLowerCase())
        .includes(command.toLowerCase()) ||
      ['type ', 'keytap ', 'go to line', 'open file', 'search', 'replace', '@cline'].some(
        (prefix) => command.toLowerCase().startsWith(prefix)
      )
    );
  }

  public dispose() {
    // Unsubscribe from frame updates
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

// Entry point for new WebSocket connections
export function handleWebSocketConnection(ws: WebSocket) {
  console.log('New WebSocket connection');
  addWebSocketConnection(ws);

  // Create a connection instance for this socket
  const vncConnection = new VSCodeVNCConnection(ws);

  ws.on('close', () => {
    vncConnection.dispose();
    removeWebSocketConnection(ws);
  });
}