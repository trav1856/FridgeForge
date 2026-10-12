import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { profileImagesDir } from "@/lib/profile-images";

/**
 * `next start` only serves public/ files that existed at startup, so uploads
 * made later would 404. This serves managed profile images (WebP we wrote) by
 * strict filename only.
 */
const NAME_RE = /^[A-Za-z0-9._-]+\.webp$/;

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { file } = await ctx.params;
  if (!NAME_RE.test(file) || file.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(path.join(profileImagesDir(), file));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
