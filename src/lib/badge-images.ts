import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

/** Max upload size for badge photos (2 MiB). */
export const BADGE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const BADGE_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type BadgeImageValidation =
  | { ok: true; ext: string; mime: string }
  | { ok: false; error: string };

/** Pure: validate mime + size for a badge photo upload. */
export function validateBadgeImageUpload(opts: {
  mime: string | null | undefined;
  size: number;
}): BadgeImageValidation {
  const mime = (opts.mime || "").toLowerCase().trim();
  const ext = BADGE_IMAGE_MIME[mime];
  if (!ext) {
    return {
      ok: false,
      error: "Image must be JPEG, PNG, WebP, or GIF.",
    };
  }
  if (!Number.isFinite(opts.size) || opts.size <= 0) {
    return { ok: false, error: "Empty image file." };
  }
  if (opts.size > BADGE_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Image must be ${BADGE_IMAGE_MAX_BYTES / (1024 * 1024)}MB or smaller.`,
    };
  }
  return { ok: true, ext, mime };
}

/** Absolute dir on disk for public badge images. */
export function badgeImagesDir(): string {
  return path.join(process.cwd(), "public", "badge-images");
}

/** Public URL path for a stored filename. */
export function badgeImagePublicPath(filename: string): string {
  return `/badge-images/${filename}`;
}

/** True if url is a local /badge-images/ path we manage. */
export function isManagedBadgeImagePath(
  url: string | null | undefined
): boolean {
  if (!url) return false;
  return /^\/badge-images\/[A-Za-z0-9._-]+$/.test(url);
}

function filenameFromPublicPath(url: string): string | null {
  if (!isManagedBadgeImagePath(url)) return null;
  return url.slice("/badge-images/".length);
}

/** Write validated bytes; returns public path `/badge-images/...`. */
export async function saveBadgeImageFile(
  bytes: Buffer,
  ext: string
): Promise<string> {
  const dir = badgeImagesDir();
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}${ext}`;
  await writeFile(path.join(dir, filename), bytes);
  return badgeImagePublicPath(filename);
}

/** Best-effort delete of a managed local badge image. */
export async function deleteManagedBadgeImage(
  url: string | null | undefined
): Promise<void> {
  const name = url ? filenameFromPublicPath(url) : null;
  if (!name) return;
  await unlink(path.join(badgeImagesDir(), name)).catch(() => {});
}
