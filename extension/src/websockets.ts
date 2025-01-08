import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import { typedRobot as robot } from './commanding/robotjs-handlers';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import { handleCommand } from './commanding/command-handler';
import { chatWithOpenAI } from './ai/api';
import { Commands } from './commanding/commands';
import { handleFileUpload } from './files/utils';
import { store } from './state/store';
import {
  addWebSocketConnection,
  removeWebSocketConnection,
} from './state/actions';

class VSCodeVNCServer {
  private streamInterval: NodeJS.Timeout | null = null;
  private lastImageHash: string | null = null;
  private screenSize: { width: number; height: number };
  private quality = {
    width: 800,       // More suitable for mobile screens
    jpegQuality: 70,  // Slightly lower quality for better performance
    fps: 10          // Lower FPS to reduce bandwidth
  };

  constructor(private ws: WebSocket) {
    // Get screen size using robotjs
    this.screenSize = robot.getScreenSize();
    this.setupVNCServer();
    this.setupWebSocketHandlers();
  }

  private async setupVNCServer() {
    try {
      // Start screen capture loop
      await this.startScreenCapture();
    } catch (error) {
      console.error('Failed to setup VNC server:', error);
    }
  }

  private async startScreenCapture() {
    let lastProcessingTime = Date.now();
  
  this.streamInterval = setInterval(async () => {
    try {
      // Skip frame if we're still processing the previous one
      if (Date.now() - lastProcessingTime < (1000 / this.quality.fps)) {
        return;
      }
      
      lastProcessingTime = Date.now();
      const screenshotBuffer = await screenshot();
      const processedImage = await this.processImage(screenshotBuffer);
      const imageHash = await this.calculateImageHash(processedImage);
      
      if (imageHash !== this.lastImageHash) {
        this.lastImageHash = imageHash;
        this.ws.send(JSON.stringify({
          type: 'screen-update',
          image: processedImage.toString('base64'),
          dimensions: {
            width: this.quality.width,
            height: Math.floor(this.quality.width * (this.screenSize.height / this.screenSize.width))
          }
        }));
      }
    } catch (error) {
      console.error('Error capturing screen:', error);
    }
  }, Math.floor(1000 / this.quality.fps));
  }

  private async processImage(imageBuffer: Buffer): Promise<Buffer> {
    // Calculate height maintaining aspect ratio
    const height = Math.floor(this.quality.width * (this.screenSize.height / this.screenSize.width));
    
    return await sharp(imageBuffer)
      .resize(this.quality.width, height, {
        fit: 'fill',
        kernel: sharp.kernel.nearest // Faster resizing
      })
      .jpeg({
        quality: this.quality.jpegQuality,
        force: true,
        optimizeScans: true,
        progressive: true
      })
      .toBuffer();
  }

  private async calculateImageHash(imageBuffer: Buffer): Promise<string> {
    // More efficient hashing using a smaller thumbnail
    return await sharp(imageBuffer)
      .resize(16, 16) // Smaller thumbnail for faster hashing
      .greyscale()
      .raw()
      .toBuffer()
      .then(buf => {
        // Only hash a subset of pixels for better performance
        const pixels = Array.from(buf).filter((_, i) => i % 4 === 0);
        return pixels.join(',');
      });
  }
  

  private setupWebSocketHandlers() {
    this.ws.on('message', async (message: WebSocket.Data) => {
      if (message instanceof Buffer) {
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
              this.updateQualitySettings(parsedMessage);
              break;
            default:
              // Handle existing message types
              if (this.isSupportedCommand(messageData)) {
                await handleCommand(messageData as never, this.ws);
              } else {
                await handleFileUpload(message, this.ws);
              }
          }
        } catch (error) {
          // If not JSON, handle as before
          if (this.isSupportedCommand(messageData)) {
            await handleCommand(messageData as never, this.ws);
          } else {
            await handleFileUpload(message, this.ws);
          }
        }
      } else if (typeof message === 'string') {
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
    });
  }

  private updateQualitySettings(data: any) {
    // Update quality settings based on client request
    if (data.width) this.quality.width = data.width;
    if (data.jpegQuality) this.quality.jpegQuality = data.jpegQuality;
    if (data.fps) {
      this.quality.fps = data.fps;
      // Restart screen capture with new FPS
      if (this.streamInterval) {
        clearInterval(this.streamInterval);
        this.startScreenCapture();
      }
    }
  }

  private async handleMouseEvent(data: any) {
    try {
      const { x, y, eventType } = data;
      
      // Convert coordinates from client size to actual screen size
      const actualX = Math.floor((x / data.clientWidth) * this.screenSize.width);
      const actualY = Math.floor((y / data.clientHeight) * this.screenSize.height);
      
      // Move mouse
      robot.moveMouse(actualX, actualY);
      
      // Handle different mouse events
      switch (eventType) {
        case 'down':
          robot.mouseToggle('down', 'left');
          break;
        case 'up':
          robot.mouseToggle('up', 'left');
          break;
        case 'move':
          // Just move the mouse, already handled above
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
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
    }
  }
}

export function handleWebSocketConnection(ws: WebSocket) {
  console.log('New WebSocket connection');
  addWebSocketConnection(ws);
  
  const vncServer = new VSCodeVNCServer(ws);

  ws.on('close', () => {
    vncServer.dispose();
    removeWebSocketConnection(ws);
  });
}