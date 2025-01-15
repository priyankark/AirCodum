import { Jimp } from 'jimp';

/**
 * Create a Jimp instance from a buffer or filepath/string.
 * No JPEG quality modifications are used here.
 */
export async function createImage(input: Buffer | string) {
  // Make sure your Jimp version supports .read
  const image = await Jimp.read(input);
  return image;
}

/**
 * Resize an image, optionally preserving aspect ratio if no height is provided.
 * Returns a JPEG Buffer by default for efficient network transfer.
 *
 * If you want to output PNG (or any other format), just change the MIME type
 * in `getBufferAsync`, e.g.:
 *    return image.getBufferAsync(Jimp.MIME_PNG);
 */
export async function resizeImage(
  input: Buffer | string,
  width: number,
  height?: number
): Promise<Buffer> {
  const image = await createImage(input);

  // If no height is specified, preserve aspect ratio
  if (!height) {
    // Jimp.AUTO is supported in recent versions of Jimp
    image.resize({w: width});
  } else {
    image.resize({w: width, h: height});
  }

  // Return as a JPEG buffer
  return await image.getBuffer('image/jpeg');
}

/**
 * Create a consistent hash of the input image.
 * Resizing to a fixed small dimension (e.g., 16x16) normalizes the image size,
 * which leads to consistent hashes for images that only differ in resolution.
 */
export async function createImageHash(input: Buffer | string): Promise<string> {
  const image = await createImage(input);

  // Resize to 16x16 so all hashed images have the same resolution
  image.resize({h: 16, w: 16});

  // Generate the hash string
  return image.hash();
}

export default {
  createImage,
  resizeImage,
  createImageHash
};