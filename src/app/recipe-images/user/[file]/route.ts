import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { recipeUserImagesDir } from "@/lib/recipe-user-images";

/**
 * `next start` only serves public/ files that existed when it started, so a
 * recipe photo or story photo uploaded later would 404 until a restart. Files
 * present at startup are still served statically; this route covers the rest,
 * at the same /recipe-images/user/<file> URL. Strict filename + extension only.
 */
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const NAME_RE = /^[A-Za-z0-9._-]+$/;

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { file } = await ctx.params;
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !NAME_RE.test(file) || file.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(path.join(recipeUserImagesDir(), file));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
