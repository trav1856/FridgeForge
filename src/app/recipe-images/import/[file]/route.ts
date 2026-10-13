import { NextRequest } from "next/server";
import path from "path";
import { serveImageFile } from "@/lib/serve-image-file";

type Ctx = { params: Promise<{ file: string }> };

/** Same dir saveImportPageImage() writes to (recipe-import-ocr.ts). */
const IMPORT_DIR = path.join(process.cwd(), "public", "recipe-images", "import");

/** Recipe import page scans saved after `next start` (same URL as public/). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { file } = await ctx.params;
  return serveImageFile(IMPORT_DIR, file);
}
