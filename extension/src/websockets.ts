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
// class ScreenCaptureManager {
//   private static instance: ScreenCaptureManager;
//   private isCapturing = false;
//   private captureInterval: NodeJS.Timeout | null = null;
//   private quality: VNCQualitySettings = {
//     width: 1280,
//     jpegQuality: 50,
//     fps: 15,
//   };

//   // We'll store just one pending screenshot at a time.
//   private pendingRawScreenshot: Buffer | null = null;

//   // True if we're currently processing a frame
//   private processingFrame = false;

//   private subscribers: Array<(frame: Buffer, dimensions: { width: number; height: number }) => void> = [];
//   private screenSize = robot.getScreenSize();

//   // Optional: Keep track of last sent frame + hash to skip duplicates
//   private lastFrameHash: string | null = null;

//   private constructor() {}

//   public static getInstance(): ScreenCaptureManager {
//     if (!ScreenCaptureManager.instance) {
//       ScreenCaptureManager.instance = new ScreenCaptureManager();
//     }
//     return ScreenCaptureManager.instance;
//   }

//   public subscribe(
//     callback: (frame: Buffer, dimensions: { width: number; height: number }) => void
//   ): () => void {
//     this.subscribers.push(callback);

//     // If no one is capturing, start
//     if (!this.isCapturing) {
//       this.startCaptureLoop();
//     }

//     return () => {
//       this.subscribers = this.subscribers.filter((cb) => cb !== callback);
//       if (this.subscribers.length === 0) {
//         this.stopCaptureLoop();
//       }
//     };
//   }

//   private startCaptureLoop() {
//     if (this.isCapturing) return;
//     this.isCapturing = true;

//     const frameDuration = 1000 / this.quality.fps;

//     // We capture periodically, but process in a separate function
//     this.captureInterval = setInterval(async () => {
//       try {
//         const raw = await screenshot();
//         this.pendingRawScreenshot = raw;
//         this.processNextFrameIfAvailable();
//       } catch (error) {
//         console.error("Capture error:", error);
//       }
//     }, frameDuration);
//   }

//   private stopCaptureLoop() {
//     if (this.captureInterval) {
//       clearInterval(this.captureInterval);
//       this.captureInterval = null;
//     }
//     this.isCapturing = false;
//   }

//   private async processNextFrameIfAvailable() {
//     // If we're already processing, return. We'll handle it once done.
//     if (this.processingFrame) return;
//     if (!this.pendingRawScreenshot) return;

//     this.processingFrame = true;
//     const rawScreenshot = this.pendingRawScreenshot;
//     this.pendingRawScreenshot = null;

//     try {
//       // 1. Process the image (resize + compress)
//       const processedImage = await this.processImage(rawScreenshot);

//       // 2. (Optional) compute a hash to skip duplicates
//       const hash = await this.calculateImageHash(processedImage);

//       // If changed, notify subscribers
//       if (hash !== this.lastFrameHash) {
//         this.lastFrameHash = hash;
//         const dims = this.getScaledDimensions();
//         this.subscribers.forEach((cb) => cb(processedImage, dims));
//       }
//     } catch (error) {
//       console.error("Error processing frame:", error);
//     } finally {
//       this.processingFrame = false;

//       // If a new screenshot arrived in the meantime, process it immediately
//       if (this.pendingRawScreenshot) {
//         this.processNextFrameIfAvailable();
//       }
//     }
//   }

//   private async processImage(buffer: Buffer): Promise<Buffer> {
//     try {
//       const height = Math.floor(
//         this.quality.width * (this.screenSize.height / this.screenSize.width)
//       );

//       const image = await jimp.createImage(buffer);
//       image.resize({ w: this.quality.width, h: height });

//       // Return as JPEG for better size/perf
//       return image.getBuffer("image/jpeg", {
//         quality: this.quality.jpegQuality,
//       });
//     } catch (error) {
//       console.error("Error in processImage:", error);
//       throw error;
//     }
//   }

//   private async calculateImageHash(imageBuffer: Buffer): Promise<string> {
//     //return jimp.createImageHash(imageBuffer);
//     return crypto.createHash("md5").update(imageBuffer).digest("hex");
//   }

//   private getScaledDimensions() {
//     const { width } = this.quality;
//     const { width: realWidth, height: realHeight } = this.screenSize;
//     const height = Math.floor(width * (realHeight / realWidth));
//     return { width, height };
//   }

//   public updateQualitySettings(quality: Partial<VNCQualitySettings>) {
//     if (quality.width !== undefined) {
//       this.quality.width = quality.width;
//     }
//     if (quality.jpegQuality !== undefined) {
//       this.quality.jpegQuality = quality.jpegQuality;
//     }
//     if (quality.fps !== undefined) {
//       this.quality.fps = quality.fps;
//       if (this.captureInterval) {
//         clearInterval(this.captureInterval);
//         this.startCaptureLoop();
//       }
//     }
//   }
// }

class ScreenCaptureManager {
  private static instance: ScreenCaptureManager;
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private quality: VNCQualitySettings = {
    width: 1280,
    jpegQuality: 80, // Reduced for better performance
    fps: 10,
  };

  private currentFrame: Buffer | null = null;
  private processingFrame = false;
  private lastFrameHash: string | null = null;
  
  // Performance tracking
  private frameProcessingTimes: number[] = [];
  private lastPerformanceAdjustment = Date.now();
  
  private subscribers: Array<(frame: Buffer, dimensions: { width: number; height: number }) => void> = [];
  private screenSize = robot.getScreenSize();
  private cachedDimensions = this.getScaledDimensions();

  private constructor() {
    // Pre-calculate dimensions
    this.cachedDimensions = this.getScaledDimensions();
  }

  public static getInstance(): ScreenCaptureManager {
    if (!ScreenCaptureManager.instance) {
      ScreenCaptureManager.instance = new ScreenCaptureManager();
    }
    return ScreenCaptureManager.instance;
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

    const frameDuration = 1000 / this.quality.fps;
    let lastFrameTime = performance.now();

    this.captureInterval = setInterval(async () => {
      const now = performance.now();
      const elapsed = now - lastFrameTime;

      // Adaptive frame skipping based on performance
      if (elapsed < frameDuration || this.processingFrame) {
        return;
      }

      lastFrameTime = now;
      
      try {
        const raw = await screenshot();
        this.currentFrame = raw;
        await this.processNextFrameIfAvailable();
      } catch (error) {
        console.error("Capture error:", error);
      }
    }, Math.max(1000 / 60, frameDuration)); // Cap at 60fps
  }

  private async processNextFrameIfAvailable() {
    if (!this.currentFrame || this.processingFrame) return;

    const startTime = performance.now();
    this.processingFrame = true;
    const frame = this.currentFrame;

    try {
      // Quick hash check using sampling
      const quickHash = this.calculateQuickHash(frame);
      if (quickHash === this.lastFrameHash) {
        this.processingFrame = false;
        return;
      }
      this.lastFrameHash = quickHash;

      const processedFrame = await this.processFrame(frame);
      
      // Track processing time
      const processingTime = performance.now() - startTime;
      this.frameProcessingTimes.push(processingTime);
      
      // Keep only last 30 samples
      if (this.frameProcessingTimes.length > 30) {
        this.frameProcessingTimes.shift();
      }

      // Adjust quality settings if needed
      this.adjustQualityIfNeeded();

      // Notify subscribers
      this.subscribers.forEach(cb => cb(processedFrame, this.cachedDimensions));
    } catch (error) {
      console.error("Processing error:", error);
    } finally {
      this.processingFrame = false;
    }
  }

  private calculateQuickHash(buffer: Buffer): string {
    // Fast sampling - take bytes at regular intervals
    const samples = new Uint8Array(32);
    const step = Math.floor(buffer.length / 32);
    for (let i = 0; i < 32; i++) {
      samples[i] = buffer[i * step];
    }
    return crypto.createHash('md5').update(samples).digest('hex');
  }

  private async processFrame(frame: Buffer): Promise<Buffer> {
    try {
      const image = await jimp.createImage(frame);
      
      // Use NEAREST for faster resizing when processing is slow
      const resizeMode = this.isProcessingSlow() ? 
        ResizeStrategy.NEAREST_NEIGHBOR : 
        ResizeStrategy.BILINEAR;

      image.resize({
        w: this.cachedDimensions.width,
        h: this.cachedDimensions.height,
        mode: resizeMode
      });

      return image.getBuffer("image/jpeg", {
        quality: this.quality.jpegQuality,
        progressive: false, // Faster encoding
        chromaSubsampling: true // Better compression
      });
    } catch (error) {
      console.error("Error in processFrame:", error);
      throw error;
    }
  }

  private isProcessingSlow(): boolean {
    if (this.frameProcessingTimes.length < 10) return false;
    const avgProcessingTime = this.frameProcessingTimes.reduce((a, b) => a + b, 0) / this.frameProcessingTimes.length;
    return avgProcessingTime > (1000 / this.quality.fps) * 0.8;
  }

  private adjustQualityIfNeeded() {
    const now = Date.now();
    if (now - this.lastPerformanceAdjustment < 5000) return; // Only adjust every 5 seconds
    
    if (this.isProcessingSlow()) {
      // Reduce quality gradually
      this.quality.jpegQuality = Math.max(70, this.quality.jpegQuality - 5);
      this.quality.width = Math.max(800, this.quality.width - 64);
      this.cachedDimensions = this.getScaledDimensions();
    } else if (this.frameProcessingTimes.length >= 30) {
      // If performing well, gradually improve quality
      const avgProcessingTime = this.frameProcessingTimes.reduce((a, b) => a + b, 0) / this.frameProcessingTimes.length;
      if (avgProcessingTime < (1000 / this.quality.fps) * 0.5) {
        this.quality.jpegQuality = Math.min(70, this.quality.jpegQuality + 2);
        this.quality.width = Math.min(1920, this.quality.width + 32);
        this.cachedDimensions = this.getScaledDimensions();
      }
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
    if (quality.jpegQuality !== undefined && quality.jpegQuality !== this.quality.jpegQuality) {
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
