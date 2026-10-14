import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { reencodePhoto } from "@/lib/image-reencode";
import { CONTENT_IMAGE_RE } from "@/lib/content/sanitize";

/** Chef photos, post covers and inline post photos. Re-encoded WebP (EXIF stripped). */
export function contentImagesDir(): string {
  return path.join(process.cwd(), "public", "content-images");
}

export function isManagedContentImage(url: string | null | undefined): url is string {
  return Boolean(url && CONTENT_IMAGE_RE.test(url));
}

export async function saveContentImage(bytes: Buffer, maxEdge = 1600): Promise<string> {
  const webp = await reencodePhoto(bytes, maxEdge);
  const dir = contentImagesDir();
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.webp`;
  await writeFile(path.join(dir, name), webp, { mode: 0o644 });
  return `/content-images/${name}`;
}

export async function deleteContentImage(url: string | null | undefined): Promise<void> {
  if (!isManagedContentImage(url)) return;
  await unlink(path.join(contentImagesDir(), url.slice("/content-images/".length))).catch(() => {});
}
