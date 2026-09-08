import * as vscode from "vscode";
import WebSocket from "ws";
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
import { messageBudget, validKey, validMouse } from "./security";
import { getApiKey } from "./ai/utils";

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
export class ScreenCaptureManager {
  private static instance: ScreenCaptureManager;
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;

  // Base configuration with better defaults
  private quality: VNCQualitySettings = {
    width: 1440,        // Default width for good quality
    jpegQuality: 85,    // Start with good quality
    fps: 30,           // Target FPS
  };

  // Frame management
  private lastFrameHash: string | null = null;
  private lastFrameSize = 0;

  // Capture cadence
  private readonly MIN_FRAME_INTERVAL = 33;  // ~30fps cap

  // Performance tracking
  private frameProcessingTimes: number[] = [];
  private lastPerformanceCheck = Date.now();
  private droppedFrames = 0;
  private framesSent = 0;

  // Quality control
  private readonly MIN_QUALITY = 55;
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
    const monitor = setInterval(() => {
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
    monitor.unref();
  }

  public subscribe(
    callback: (frame: Buffer, dimensions: { width: number; height: number }) => void
  ): () => void {
    this.subscribers.push(callback);
    this.lastFrameHash = null;
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

  private generation = 0;
  private inFlight = false;
  private lastRefresh = 0;

  private startCaptureLoop() {
    if (this.isCapturing) return;
    this.isCapturing = true;
    const generation = ++this.generation;
    const active = () => this.isCapturing && generation === this.generation;
    const captureFrame = async () => {
      if (!active()) return;
      if (this.inFlight) { this.captureInterval = setTimeout(captureFrame, 16); return; }
      this.inFlight = true;
      const started = performance.now();
      try {
        const raw = await screenshot();
        if (!active()) return;
        const hash = crypto.createHash('sha256').update(raw).digest('hex');
        // Periodic refresh allows a slow/new subscriber to recover on an idle desktop.
        if (hash !== this.lastFrameHash || Date.now() - this.lastRefresh >= 1000) {
          const dimensions = { ...this.cachedDimensions };
          const frame = await this.processFrame(raw, dimensions);
          if (!active()) return;
          this.lastFrameHash = hash;
          this.lastRefresh = Date.now();
          this.lastFrameSize = frame.length;
          this.framesSent++;
          this.updatePerformanceMetrics(performance.now() - started);
          for (const subscriber of this.subscribers) {
            try { subscriber(frame, dimensions); } catch { /* A closed client cannot stop capture. */ }
          }
          this.adjustQualityIfNeeded();
        }
      } catch { console.error('Screen capture failed; retrying.'); }
      finally {
        this.inFlight = false;
        if (active()) this.captureInterval = setTimeout(captureFrame,
          Math.max(1, 1000 / this.quality.fps - (performance.now() - started)));
      }
    };
    void captureFrame();
  }

  private async processFrame(frame: Buffer, dimensions: { width: number; height: number }): Promise<Buffer> {
    const image = await jimp.createImage(frame);

    // Resize if needed
    if (image.width !== dimensions.width ||
        image.height !== dimensions.height) {
      const resizeMode = this.isProcessingSlow()
        ? ResizeStrategy.NEAREST_NEIGHBOR  // Faster but lower quality
        : ResizeStrategy.BILINEAR;         // Better quality

      image.resize({
        w: dimensions.width,
        h: dimensions.height,
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
    const width = Math.min(this.quality.width, this.screenSize.width);
    const { width: realWidth, height: realHeight } = this.screenSize;
    const height = Math.floor(width * (realHeight / realWidth));
    return { width, height };
  }

  public updateQualitySettings(quality: Partial<VNCQualitySettings>) {
    let changed = false;

    if (Number.isFinite(quality.width) && quality.width !== undefined &&
        quality.width >= this.MIN_WIDTH &&
        quality.width <= this.MAX_WIDTH &&
        quality.width !== this.quality.width) {
      this.quality.width = quality.width;
      this.cachedDimensions = this.getScaledDimensions();
      changed = true;
    }

    if (Number.isFinite(quality.jpegQuality) && quality.jpegQuality !== undefined &&
        quality.jpegQuality >= this.MIN_QUALITY &&
        quality.jpegQuality <= this.MAX_QUALITY &&
        quality.jpegQuality !== this.quality.jpegQuality) {
      this.quality.jpegQuality = quality.jpegQuality;
      changed = true;
    }

    if (Number.isFinite(quality.fps) && quality.fps !== undefined &&
        quality.fps >= 1 &&
        quality.fps <= 60 &&
        quality.fps !== this.quality.fps) {
      this.quality.fps = quality.fps;
      changed = true;
    }

    if (changed) {
        this.lastFrameHash = null;
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
    this.generation++;
    if (this.captureInterval) {
      clearTimeout(this.captureInterval);
      this.captureInterval = null;
    }
    this.isCapturing = false;
    this.lastFrameHash = null;
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
  private mouseDown = false;

  constructor(private ws: WebSocket) {
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers() {
    const budget = messageBudget();
    let queued = 0;
    let chain = Promise.resolve();
    this.ws.on("message", (message: WebSocket.RawData, isBinary: boolean) => {
      const buffer = Buffer.isBuffer(message) ? message : Buffer.from(message as ArrayBuffer);
      if (!budget(buffer.length) || queued >= 32) { this.ws.close(1008, "Message limit exceeded"); return; }
      queued++;
      chain = chain.then(async () => {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        if (isBinary) { await handleFileUpload(buffer, this.ws); return; }
        if (buffer.length > 65536) throw new Error("Text message too large");
        const text = buffer.toString('utf8');
        if (!text.trim().startsWith('{')) {
          if (this.isSupportedCommand(text)) await handleCommand(text as never, this.ws);
          else if (text.length <= 4096 && getApiKey()) {
            const response = await chatWithOpenAI(text, getApiKey()!);
            store.getState().webview.panel?.webview.postMessage({ type: 'chatResponse', response });
          }
          return;
        }
        const data = JSON.parse(text);
        switch (data.type) {
          case 'vnc_start': this.subscribeToFrameUpdates(); break;
          case 'vnc_stop': this.dispose(); break;
          case 'mouse-event': case 'vnc_mouse_event':
            if (!validMouse(data)) throw new Error('Invalid mouse event');
            await this.handleMouseEvent(data); break;
          case 'keyboard-event': case 'vnc_keyboard_event':
            if (!validKey(data)) throw new Error('Invalid key event');
            await this.handleKeyboardEvent(data); break;
          case 'vnc_type':
            if (typeof data.text !== 'string' || data.text.length > 4096) throw new Error('Invalid text');
            robot.typeString(data.text); break;
          case 'quality-update': case 'vnc_quality_update':
            ScreenCaptureManager.getInstance().updateQualitySettings(data); break;
          case 'list_sessions': case 'claude_list_sessions': break;
          default: throw new Error('Unsupported message');
        }
      }).catch(() => {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'error', message: 'Invalid request' }));
      }).finally(() => { queued--; });
    });
    this.ws.on('error', () => this.dispose());
    this.ws.on('close', () => this.dispose());
  }

  private subscribeToFrameUpdates() {
    if (this.unsubscribe) return;
    const manager = ScreenCaptureManager.getInstance();
    // Subscribe to frames as they arrive
    this.unsubscribe = manager.subscribe((frame, dimensions) => {
      if (this.ws.readyState !== WebSocket.OPEN || this.ws.bufferedAmount > 0) return;
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
          timestamp: Date.now(),
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
          this.mouseDown = true;
          break;
        case "up":
          robot.mouseToggle("up", "left");
          this.mouseDown = false;
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
    if (this.mouseDown) {
      try { robot.mouseToggle("up", "left"); } catch {}
      this.mouseDown = false;
    }
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
