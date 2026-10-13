import { NextRequest } from "next/server";
import { recipeUserImagesDir } from "@/lib/recipe-user-images";
import { serveImageFile } from "@/lib/serve-image-file";

type Ctx = { params: Promise<{ file: string }> };

/** Recipe + story photos uploaded after `next start` (same URL as public/). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { file } = await ctx.params;
  return serveImageFile(recipeUserImagesDir(), file);
}
