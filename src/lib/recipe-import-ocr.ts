import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import {
  boxToPixelRect,
  normalizeBox,
  type NormBox,
} from "@/lib/recipe-import-crop";

export type OcrImageInput = {
  buffer: Buffer;
  mimeType?: string | null;
  /** When set, crop before OCR. Normalized 0–1. */
  box?: NormBox | null;
  /** If true and no box, use full page. */
  useFullPage?: boolean;
};

export type PreparedCrop = {
  cropBuffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  box: NormBox;
};

/** Crop (optional) and normalize to a PNG buffer for OCR. */
export async function prepareCropForOcr(
  input: OcrImageInput
): Promise<PreparedCrop> {
  const meta = await sharp(input.buffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (width < 8 || height < 8) {
    throw new Error("Image is too small to OCR");
  }

  const box =
    normalizeBox(input.box) ||
    (input.useFullPage || !input.box
      ? ({ x: 0, y: 0, w: 1, h: 1 } as NormBox)
      : null);
  if (!box) {
    throw new Error("Draw a bounding box around the recipe (or use full page)");
  }

  const rect = boxToPixelRect(box, width, height);
  if (!rect) {
    throw new Error("Bounding box is too small");
  }

  const cropBuffer = await sharp(input.buffer)
    .extract({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    })
    .png()
    .toBuffer();

  return {
    cropBuffer: Buffer.from(cropBuffer),
    mimeType: "image/png",
    width: rect.width,
    height: rect.height,
    box,
  };
}

/** Run tesseract.js OCR on an image buffer (Node). */
export async function ocrImageBuffer(buffer: Buffer): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const result = await Tesseract.recognize(
    // Buffer generic variance vs tesseract ImageLike
    buffer as unknown as Parameters<typeof Tesseract.recognize>[0],
    "eng",
    {
      logger: () => {},
    }
  );
  return (result.data.text || "").replace(/\r\n/g, "\n").trim();
}

const IMPORT_DIR = path.join(process.cwd(), "public", "recipe-images", "import");

/** Persist a page scan under public/recipe-images/import/ (gitignored). */
export async function saveImportPageImage(
  buffer: Buffer,
  mimeType?: string | null
): Promise<{ relativeUrl: string; absolutePath: string }> {
  await mkdir(IMPORT_DIR, { recursive: true });
  const ext =
    mimeType?.includes("png")
      ? "png"
      : mimeType?.includes("webp")
        ? "webp"
        : "jpg";
  const id =
    createHash("sha256")
      .update(buffer)
      .update(randomBytes(8))
      .digest("hex")
      .slice(0, 24) +
    "-" +
    Date.now().toString(36);
  const filename = `${id}.${ext}`;
  const absolutePath = path.join(IMPORT_DIR, filename);
  await writeFile(absolutePath, buffer);
  return {
    relativeUrl: `/recipe-images/import/${filename}`,
    absolutePath,
  };
}
