import * as os from "os";
import { resizeImage as jimpResizeImage } from "./jimp";

export function getIPAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === "IPv4" && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return "127.0.0.1";
}

export async function resizeImage(
  filePath: string,
  width: number
): Promise<Buffer> {
  try {
    return await jimpResizeImage(filePath, width);
  } catch (error) {
    console.error("Error resizing image:", error);
    throw error;
  }
}

export function isImage(buffer: Buffer): boolean {
  const fileSignature = buffer.toString("hex", 0, 4).toUpperCase();
  return (
    fileSignature.startsWith("89504E47") || // PNG
    fileSignature.startsWith("FFD8FF") || // JPEG
    fileSignature.startsWith("47494638") // GIF
  );
}
