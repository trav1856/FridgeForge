import sharp from "sharp";

/**
 * Re-encode an uploaded photo: verify it really is an image, auto-orient, cap
 * the size and write WebP. sharp does not copy EXIF/GPS/XMP metadata unless
 * asked (.withMetadata), so the output carries none.
 */
export const REENCODE_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const ALLOWED = new Set(["jpeg", "png", "webp", "gif", "heif", "avif"]);

export class ImageReencodeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ImageReencodeError";
    this.status = status;
  }
}

export async function reencodePhoto(bytes: Buffer, maxEdge = 1200): Promise<Buffer> {
  if (!bytes.length) throw new ImageReencodeError("Empty image file.");
  if (bytes.length > REENCODE_MAX_INPUT_BYTES) {
    throw new ImageReencodeError("Image must be 8MB or smaller.", 413);
  }
  let meta: sharp.Metadata;
  try {
    meta = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageReencodeError("That file isn't a readable image.");
  }
  if (!meta.format || !ALLOWED.has(meta.format)) {
    throw new ImageReencodeError("Image must be JPEG, PNG, WebP, or GIF.");
  }
  try {
    return await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", animated: false })
      .rotate()
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageReencodeError("That file isn't a readable image.");
  }
}
