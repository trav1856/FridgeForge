import { NextRequest } from "next/server";
import { pantryUserImagesDir } from "@/lib/pantry-user-images";
import { serveImageFile } from "@/lib/serve-image-file";

type Ctx = { params: Promise<{ file: string }> };

/** Pantry photos uploaded after `next start` (same URL as public/). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { file } = await ctx.params;
  return serveImageFile(pantryUserImagesDir(), file);
}
