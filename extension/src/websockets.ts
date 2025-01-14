import * as vscode from "vscode";
import * as WebSocket from "ws";
import { typedRobot as robot } from "./commanding/robotjs-handlers";
import screenshot from "screenshot-desktop";
import { handleCommand } from "./commanding/command-handler";
import { chatWithOpenAI } from "./ai/api";
import { handleFileUpload } from "./files/utils";
import { store } from "./state/store";
import {
  addWebSocketConnection,
  removeWebSocketConnection,
} from "./state/actions";
import crypto from "crypto";

import { Commands } from "./commanding/commands";
import jimp from "./jimp";
import { ResizeStrategy } from "jimp";

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
    fps: 10,
  };

  private currentFrame: Buffer | null = null;
  private processingFrame = false;
  private lastFrameHash: string | null = null;
  private pendingFrame: Buffer | null = null;
  private lastFrameSentTime = 0;
  private readonly MIN_FRAME_INTERVAL = 50;
  private coalesceTimer: NodeJS.Timeout | null = null;

  private frameProcessingTimes: number[] = [];
  private lastPerformanceAdjustment = Date.now();
  private droppedFrames = 0;
  private framesSent = 0;
  private lastFrameSize = 0;

  private subscribers: Array<
    (frame: Buffer, dimensions: { width: number; height: number }) => void
  > = [];
  private screenSize = robot.getScreenSize();
  private cachedDimensions = this.getScaledDimensions();
  private previousImageData: Buffer | null = null;

  private constructor() {
    this.cachedDimensions = this.getScaledDimensions();

    setInterval(() => {
      if (this.isCapturing) {
        const dropRate =
          (this.droppedFrames / (this.droppedFrames + this.framesSent)) * 100;
        const avgFrameSize = this.lastFrameSize / 1024;
        console.debug(
          `Performance stats - Sent: ${this.framesSent}, Dropped: ${this.droppedFrames}, ` +
            `Drop rate: ${dropRate.toFixed(
              1
            )}%, Avg frame size: ${avgFrameSize.toFixed(1)}KB`
        );
        this.droppedFrames = 0;
        this.framesSent = 0;
      }
    }, 5000);
  }

  public static getInstance(): ScreenCaptureManager {
    if (!ScreenCaptureManager.instance) {
      ScreenCaptureManager.instance = new ScreenCaptureManager();
    }
    return ScreenCaptureManager.instance;
  }

  public subscribe(
    callback: (
      frame: Buffer,
      dimensions: { width: number; height: number }
    ) => void
  ): () => void {
    this.subscribers.push(callback);
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
    let lastFrameTime = performance.now();

    this.captureInterval = setInterval(async () => {
      const now = performance.now();
      const elapsed = now - lastFrameTime;

      if (elapsed < frameDuration * 0.8 || this.processingFrame) {
        this.droppedFrames++;
        return;
      }

      lastFrameTime = now;

      try {
        const raw = await screenshot();
        this.handleNewFrame(raw);
      } catch (error) {
        console.error("Capture error:", error);
      }
    }, Math.max(1000 / 60, frameDuration));
  }

  private calculateQuickHash(buffer: Buffer): string {
    const samples = new Uint8Array(16);
    const step = Math.floor(buffer.length / 16);
    const offset = Math.floor(step / 2);

    for (let i = 0; i < 16; i++) {
      samples[i] = buffer[offset + i * step];
    }

    return crypto.createHash("md5").update(samples).digest("hex");
  }

  private handleNewFrame(frame: Buffer) {
    const quickHash = this.calculateQuickHash(frame);
    if (quickHash === this.lastFrameHash) {
      this.droppedFrames++;
      return;
    }

    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameSentTime;

    if (
      this.processingFrame ||
      timeSinceLastFrame < this.MIN_FRAME_INTERVAL * 0.8
    ) {
      this.droppedFrames++;
      return;
    }

    this.lastFrameHash = quickHash;
    this.pendingFrame = frame;

    if (timeSinceLastFrame >= this.MIN_FRAME_INTERVAL) {
      this.processPendingFrame();
    } else if (!this.coalesceTimer) {
      this.coalesceTimer = setTimeout(() => {
        this.processPendingFrame();
        this.coalesceTimer = null;
      }, this.MIN_FRAME_INTERVAL - timeSinceLastFrame);
    }
  }

  private async processPendingFrame() {
    if (!this.pendingFrame || this.processingFrame) return;

    const now = performance.now();
    if (now - this.lastFrameSentTime < this.MIN_FRAME_INTERVAL) {
      this.droppedFrames++;
      return;
    }

    this.processingFrame = true;
    const frame = this.pendingFrame;
    this.pendingFrame = null;

    try {
      const startTime = performance.now();
      const processedFrame = await this.processFrame(frame);

      const processingTime = performance.now() - startTime;
      this.frameProcessingTimes.push(processingTime);

      if (this.frameProcessingTimes.length > 30) {
        this.frameProcessingTimes.shift();
      }

      this.adjustQualityIfNeeded();

      this.framesSent++;
      this.lastFrameSentTime = now;
      this.lastFrameSize = processedFrame.length;
      this.subscribers.forEach((cb) =>
        cb(processedFrame, this.cachedDimensions)
      );

      this.previousImageData = processedFrame;
    } catch (error) {
      console.error("Processing error:", error);
    } finally {
      this.processingFrame = false;
    }
  }

  private async processFrame(frame: Buffer): Promise<Buffer> {
    try {
      const image = await jimp.createImage(frame);

      if (
        image.width !== this.cachedDimensions.width ||
        image.height !== this.cachedDimensions.height
      ) {
        const resizeMode = this.isProcessingSlow()
          ? ResizeStrategy.NEAREST_NEIGHBOR
          : ResizeStrategy.BILINEAR;

        image.resize({
          w: this.cachedDimensions.width,
          h: this.cachedDimensions.height,
          mode: resizeMode,
        });
      }

      const quality = this.detectHighMotion()
        ? Math.min(this.quality.jpegQuality, 70)
        : this.quality.jpegQuality;

      return image.getBuffer("image/jpeg", {
        quality,
        progressive: false,
        chromaSubsampling: true,
        fastEntropy: true,
      });
    } catch (error) {
      console.error("Error in processFrame:", error);
      throw error;
    }
  }

  private detectHighMotion(): boolean {
    if (this.frameProcessingTimes.length < 5) return false;
    const recentTimes = this.frameProcessingTimes.slice(-5);
    const avgTime = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
    return avgTime > (1000 / this.quality.fps) * 0.7;
  }

  private isProcessingSlow(): boolean {
    if (this.frameProcessingTimes.length < 10) return false;
    const avgProcessingTime =
      this.frameProcessingTimes.reduce((a, b) => a + b, 0) /
      this.frameProcessingTimes.length;
    return avgProcessingTime > (1000 / this.quality.fps) * 0.8;
  }

  private adjustQualityIfNeeded() {
    const now = Date.now();
    if (now - this.lastPerformanceAdjustment < 2000) return;

    const recentTimes = this.frameProcessingTimes.slice(-10);
    const avgProcessingTime =
      recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
    const targetFrameTime = 1000 / this.quality.fps;

    if (avgProcessingTime > targetFrameTime * 0.8) {
      this.quality.jpegQuality = Math.max(65, this.quality.jpegQuality - 8);
      this.quality.width = Math.max(800, this.quality.width - 128);
      this.cachedDimensions = this.getScaledDimensions();
    } else if (avgProcessingTime < targetFrameTime * 0.4) {
      this.quality.jpegQuality = Math.min(85, this.quality.jpegQuality + 1);
      this.quality.width = Math.min(1920, this.quality.width + 16);
      this.cachedDimensions = this.getScaledDimensions();
    }

    this.lastPerformanceAdjustment = now;
  }

  private getScaledDimensions() {
    const { width } = this.quality;
    const { width: realWidth, height: realHeight } = this.screenSize;
    const height = Math.floor(width * (realHeight / realWidth));
    return { width, height };
  }

  public updateQualitySettings(quality: Partial<VNCQualitySettings>) {
    let changed = false;

    if (quality.width !== undefined && quality.width !== this.quality.width) {
      this.quality.width = quality.width;
      this.cachedDimensions = this.getScaledDimensions();
      changed = true;
    }
    if (
      quality.jpegQuality !== undefined &&
      quality.jpegQuality !== this.quality.jpegQuality
    ) {
      this.quality.jpegQuality = quality.jpegQuality;
      changed = true;
    }
    if (quality.fps !== undefined && quality.fps !== this.quality.fps) {
      this.quality.fps = quality.fps;
      changed = true;
    }

    if (changed && this.captureInterval) {
      this.restartCaptureLoop();
    }
  }

  private stopCaptureLoop() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.isCapturing = false;
    this.currentFrame = null;
    this.lastFrameHash = null;
    this.frameProcessingTimes = [];
    this.previousImageData = null;
  }

  private restartCaptureLoop() {
    this.stopCaptureLoop();
    this.startCaptureLoop();
  }
}

/**
 * Per-connection class that handles the WebSocket for:
 * - Sending frames as Base64 (to maintain existing client contracts)
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
    this.ws.on("message", async (message: WebSocket.Data) => {
      if (message instanceof Buffer) {
        await this.handleBufferMessage(message);
      } else if (typeof message === "string") {
        await this.handleStringMessage(message);
      }
    });

    this.ws.on("close", () => {
      this.dispose();
    });
  }

  private async handleBufferMessage(message: Buffer) {
    const messageData = message.toString();
    try {
      const parsedMessage = JSON.parse(messageData);
      switch (parsedMessage.type) {
        case "mouse-event":
          await this.handleMouseEvent(parsedMessage);
          break;
        case "keyboard-event":
          await this.handleKeyboardEvent(parsedMessage);
          break;
        case "quality-update":
          ScreenCaptureManager.getInstance().updateQualitySettings(
            parsedMessage
          );
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
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === "quality-update") {
        ScreenCaptureManager.getInstance().updateQualitySettings(parsedMessage);
        return;
      }
      // If not recognized JSON, treat it as text for AI chat
      throw new Error("Not recognized JSON");
    } catch {
      // Chat with OpenAI fallback
      try {
        const response = await chatWithOpenAI(
          message,
          store.getState().apiKey || ""
        );
        store.getState().webview.panel?.webview.postMessage({
          type: "chatResponse",
          response,
        });
      } catch (error: any) {
        store.getState().webview.panel?.webview.postMessage({
          type: "error",
          message: "Error chatting with AI",
        });
      }
    }
  }

  private subscribeToFrameUpdates() {
    const manager = ScreenCaptureManager.getInstance();
    // Subscribe to frames as they arrive
    this.unsubscribe = manager.subscribe((frame, dimensions) => {
      // Convert to Base64
      const base64Image = frame.toString("base64");

      // Your existing client contract likely expects something like:
      // {
      //   type: "screen-update",
      //   image: "...base64 string...",
      //   dimensions: { width, height }
      // }
      this.ws.send(
        JSON.stringify({
          type: "screen-update",
          image: base64Image,
          dimensions,
        })
      );
    });
  }

  private getScaledDimensions() {
    const { width } = ScreenCaptureManager.getInstance()["quality"];
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
        case "down":
          robot.mouseToggle("down", "left");
          break;
        case "up":
          robot.mouseToggle("up", "left");
          break;
        case "move":
          // Already moved above
          break;
      }
    } catch (error) {
      console.error("Error handling mouse event:", error);
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
      console.error("Error handling keyboard event:", error);
    }
  }

  private isSupportedCommand(command: string): boolean {
    return (
      Object.keys(Commands)
        .map((e) => e.toLowerCase())
        .includes(command.toLowerCase()) ||
      [
        "type ",
        "keytap ",
        "go to line",
        "open file",
        "search",
        "replace",
        "@cline",
      ].some((prefix) => command.toLowerCase().startsWith(prefix))
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
  console.log("New WebSocket connection");
  addWebSocketConnection(ws);

  // Create a connection instance for this socket
  const vncConnection = new VSCodeVNCConnection(ws);

  ws.on("close", () => {
    vncConnection.dispose();
    removeWebSocketConnection(ws);
  });
}
