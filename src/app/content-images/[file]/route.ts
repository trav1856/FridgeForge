import { NextRequest } from "next/server";
import { contentImagesDir } from "@/lib/content/images";
import { serveImageFile } from "@/lib/serve-image-file";

type Ctx = { params: Promise<{ file: string }> };

/** Chef + Kitchen Table photos uploaded after `next start` (same URL as public/). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { file } = await ctx.params;
  return serveImageFile(contentImagesDir(), file);
}
