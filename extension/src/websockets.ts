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
 * Manages screen capture for all connected clients.
 * Features frame coalescing and adaptive quality settings.
 */
class ScreenCaptureManager {
  private static instance: ScreenCaptureManager;
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;

  // Base configuration with better defaults
  private quality: VNCQualitySettings = {
    width: 1440,        // Default width for good quality
    jpegQuality: 85,    // Start with good quality
    fps: 45,           // Target FPS
  };

  // Frame management
  private processingFrame = false;
  private lastFrameHash: string | null = null;
  private lastFrameSentTime = 0;
  private lastFrameSize = 0;

  // Frame coalescing
  private pendingFrames: Buffer[] = [];
  private coalesceTimer: NodeJS.Timeout | null = null;
  private readonly COALESCE_MAX_WAIT = 100; // ms
  private readonly MIN_FRAME_INTERVAL = 33;  // ~30fps cap

  // Performance tracking
  private frameProcessingTimes: number[] = [];
  private lastPerformanceCheck = Date.now();
  private droppedFrames = 0;
  private framesSent = 0;

  // Quality control
  private readonly MIN_QUALITY = 80;
  private readonly MAX_QUALITY = 90;
  private readonly MIN_WIDTH = 1024;
  private readonly MAX_WIDTH = 1920;
  private readonly PERFORMANCE_CHECK_INTERVAL = 2000; // ms

  private subscribers: Array<(frame: Buffer, dimensions: { width: number; height: number }) => void> = [];
  private screenSize = robot.getScreenSize();
  private cachedDimensions = this.getScaledDimensions();

  private constructor() {
    this.setupPerformanceMonitoring();
  }

  public static getInstance(): ScreenCaptureManager {
    if (!ScreenCaptureManager.instance) {
      ScreenCaptureManager.instance = new ScreenCaptureManager();
    }
    return ScreenCaptureManager.instance;
  }

  private setupPerformanceMonitoring() {
    setInterval(() => {
      if (!this.isCapturing) return;

      const dropRate = (this.droppedFrames / (this.droppedFrames + this.framesSent)) * 100;
      const avgFrameSize = this.lastFrameSize / 1024;
      const avgProcessingTime = this.getAverageProcessingTime();

      console.debug(
        `Performance: FPS=${this.framesSent}, Dropped=${this.droppedFrames}, ` +
        `Drop Rate=${dropRate.toFixed(1)}%, Size=${avgFrameSize.toFixed(1)}KB, ` +
        `Processing=${avgProcessingTime.toFixed(1)}ms, Quality=${this.quality.jpegQuality}`
      );

      this.droppedFrames = 0;
      this.framesSent = 0;
    }, 1000);
  }

  public subscribe(
    callback: (frame: Buffer, dimensions: { width: number; height: number }) => void
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

    const captureFrame = async () => {
      if (!this.isCapturing) return;

      const now = performance.now();
      const timeSinceLastFrame = now - this.lastFrameSentTime;

      // Skip frame if we're processing or it's too soon
      if (this.processingFrame || timeSinceLastFrame < this.MIN_FRAME_INTERVAL) {
        this.droppedFrames++;
        return;
      }

      try {
        const raw = await screenshot();
        await this.handleNewFrame(raw);
      } catch (error) {
        console.error("Capture error:", error);
      }

      // Schedule next capture with dynamic interval
      const nextInterval = Math.max(
        this.MIN_FRAME_INTERVAL,
        1000 / this.quality.fps
      );
      setTimeout(captureFrame, nextInterval);
    };

    captureFrame();
  }

  private calculateFrameHash(buffer: Buffer): string {
    // Sample 32 points across the frame for quick comparison
    const samples = new Uint8Array(32);
    const step = Math.floor(buffer.length / 32);
    const offset = Math.floor(step / 2);

    for (let i = 0; i < 32; i++) {
      samples[i] = buffer[offset + i * step];
    }

    return crypto.createHash("md5").update(samples).digest("hex");
  }

  private async handleNewFrame(frame: Buffer) {
    const frameHash = this.calculateFrameHash(frame);
    if (frameHash === this.lastFrameHash) {
      this.droppedFrames++;
      return;
    }

    this.lastFrameHash = frameHash;
    this.pendingFrames.push(frame);

    // Start coalescing timer if not already running
    if (!this.coalesceTimer) {
      this.coalesceTimer = setTimeout(() => {
        this.processCoalescedFrames();
      }, this.COALESCE_MAX_WAIT);
    }
  }

  private async processCoalescedFrames() {
    if (this.pendingFrames.length === 0 || this.processingFrame) return;

    this.processingFrame = true;
    this.coalesceTimer = null;

    // Process most recent frame
    const frame = this.pendingFrames[this.pendingFrames.length - 1];
    this.pendingFrames = [];

    try {
      const startTime = performance.now();
      const processedFrame = await this.processFrame(frame);
      const processingTime = performance.now() - startTime;

      this.updatePerformanceMetrics(processingTime);
      this.adjustQualityIfNeeded();

      this.framesSent++;
      this.lastFrameSentTime = performance.now();
      this.lastFrameSize = processedFrame.length;

      // Notify subscribers
      this.subscribers.forEach((cb) => cb(processedFrame, this.cachedDimensions));
    } catch (error) {
      console.error("Frame processing error:", error);
    } finally {
      this.processingFrame = false;

      // Process any frames that arrived during processing
      if (this.pendingFrames.length > 0) {
        this.coalesceTimer = setTimeout(() => {
          this.processCoalescedFrames();
        }, Math.min(this.COALESCE_MAX_WAIT, this.MIN_FRAME_INTERVAL));
      }
    }
  }

  private async processFrame(frame: Buffer): Promise<Buffer> {
    const image = await jimp.createImage(frame);

    // Resize if needed
    if (image.width !== this.cachedDimensions.width || 
        image.height !== this.cachedDimensions.height) {
      const resizeMode = this.isProcessingSlow()
        ? ResizeStrategy.NEAREST_NEIGHBOR  // Faster but lower quality
        : ResizeStrategy.BILINEAR;         // Better quality

      image.resize({
        w: this.cachedDimensions.width,
        h: this.cachedDimensions.height,
        mode: resizeMode,
      });
    }

    // Adjust quality based on motion
    const quality = this.detectHighMotion()
      ? Math.max(this.MIN_QUALITY, this.quality.jpegQuality - 10)
      : this.quality.jpegQuality;

    return image.getBuffer("image/jpeg", {
      quality,
      progressive: false,
      chromaSubsampling: true,
      fastEntropy: true,
    });
  }

  private updatePerformanceMetrics(processingTime: number) {
    this.frameProcessingTimes.push(processingTime);
    if (this.frameProcessingTimes.length > 30) {
      this.frameProcessingTimes.shift();
    }
  }

  private detectHighMotion(): boolean {
    if (this.frameProcessingTimes.length < 5) return false;
    const recentTimes = this.frameProcessingTimes.slice(-5);
    const avgTime = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
    return avgTime > this.MIN_FRAME_INTERVAL * 0.7;
  }

  private isProcessingSlow(): boolean {
    const avgTime = this.getAverageProcessingTime();
    return avgTime > this.MIN_FRAME_INTERVAL * 0.8;
  }

  private getAverageProcessingTime(): number {
    if (this.frameProcessingTimes.length === 0) return 0;
    return (
      this.frameProcessingTimes.reduce((a, b) => a + b, 0) /
      this.frameProcessingTimes.length
    );
  }

  private adjustQualityIfNeeded() {
    const now = Date.now();
    if (now - this.lastPerformanceCheck < this.PERFORMANCE_CHECK_INTERVAL) return;

    const avgProcessingTime = this.getAverageProcessingTime();
    const dropRate = this.droppedFrames / (this.droppedFrames + this.framesSent);

    if (dropRate > 0.2 || avgProcessingTime > this.MIN_FRAME_INTERVAL) {
      // Reduce quality more aggressively when dropping frames
      this.quality.jpegQuality = Math.max(
        this.MIN_QUALITY,
        this.quality.jpegQuality - 5
      );
      this.quality.width = Math.max(
        this.MIN_WIDTH,
        this.quality.width - 128
      );
      this.cachedDimensions = this.getScaledDimensions();
    } 
    else if (dropRate < 0.05 && avgProcessingTime < this.MIN_FRAME_INTERVAL * 0.5) {
      // Gradually improve quality when performance is good
      this.quality.jpegQuality = Math.min(
        this.MAX_QUALITY,
        this.quality.jpegQuality + 1
      );
      this.quality.width = Math.min(
        this.MAX_WIDTH,
        this.quality.width + 64
      );
      this.cachedDimensions = this.getScaledDimensions();
    }

    this.lastPerformanceCheck = now;
  }

  private getScaledDimensions() {
    const { width } = this.quality;
    const { width: realWidth, height: realHeight } = this.screenSize;
    const height = Math.floor(width * (realHeight / realWidth));
    return { width, height };
  }

  public updateQualitySettings(quality: Partial<VNCQualitySettings>) {
    let changed = false;

    if (quality.width !== undefined && 
        quality.width >= this.MIN_WIDTH && 
        quality.width <= this.MAX_WIDTH && 
        quality.width !== this.quality.width) {
      this.quality.width = quality.width;
      this.cachedDimensions = this.getScaledDimensions();
      changed = true;
    }

    if (quality.jpegQuality !== undefined && 
        quality.jpegQuality >= this.MIN_QUALITY && 
        quality.jpegQuality <= this.MAX_QUALITY && 
        quality.jpegQuality !== this.quality.jpegQuality) {
      this.quality.jpegQuality = quality.jpegQuality;
      changed = true;
    }

    if (quality.fps !== undefined && 
        quality.fps >= 1 && 
        quality.fps <= 60 && 
        quality.fps !== this.quality.fps) {
      this.quality.fps = quality.fps;
      changed = true;
    }

    if (changed) {
      this.resetPerformanceMetrics();
    }
  }

  private resetPerformanceMetrics() {
    this.frameProcessingTimes = [];
    this.lastPerformanceCheck = Date.now();
    this.droppedFrames = 0;
    this.framesSent = 0;
  }

  private stopCaptureLoop() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    if (this.coalesceTimer) {
      clearTimeout(this.coalesceTimer);
      this.coalesceTimer = null;
    }
    this.isCapturing = false;
    this.lastFrameHash = null;
    this.pendingFrames = [];
    this.resetPerformanceMetrics();
  }

  public getQualitySettings(): VNCQualitySettings {
    return { ...this.quality };
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
