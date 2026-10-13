import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * `next start` only serves public/ files that existed when it started. Route
 * handlers at the same URL serve files written later. Files present at startup
 * are still served statically. Strict filename + image extension only.
 */
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const NAME_RE = /^[A-Za-z0-9._-]+$/;

export function imageTypeForFile(file: string): string | null {
  if (!NAME_RE.test(file) || file.includes("..")) return null;
  return TYPES[path.extname(file).toLowerCase()] ?? null;
}

export async function serveImageFile(dir: string, file: string) {
  const type = imageTypeForFile(file);
  if (!type) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(dir, file));
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
