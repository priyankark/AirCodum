import { WebSocket } from "ws";
import screenshot from "screenshot-desktop";
import { saveFile } from "../files/utils";
import { resizeImage } from "../utils";

/**
 * Take a screenshot of the screen and send it to the mobile app via the WebSocket connection.
 * @param ws
 */
export async function takeAndSendScreenshot(ws: WebSocket) {
  try {
    const scnsht = await screenshot({ format: "png" });
    let screenshotBuffer: Buffer;
    if (Array.isArray(scnsht)) {
      screenshotBuffer = scnsht[0].data; // Use the first display's screenshot
    } else {
      screenshotBuffer = scnsht;
    }

    const fileInfo = await saveFile(screenshotBuffer);
    console.log("fileInfo", fileInfo);

    const resizedImageBuffer = await resizeImage(fileInfo.filePath, 800);

    const base64 = resizedImageBuffer.toString("base64");
    ws.send(`data:image/png;base64,${base64}`);
  } catch (error) {
    console.error("Error taking or sending screenshot:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to take or send screenshot",
      })
    );
  }
}
