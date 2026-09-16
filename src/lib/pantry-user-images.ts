import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { rowMatchesScope } from "@/lib/household";
import { isUserPantryImage } from "@/lib/pantry-images";

export { isUserPantryImage };

/** Max upload size for user pantry photos (5 MiB). */
export const PANTRY_USER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const PANTRY_USER_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type PantryUserImageValidation =
  | { ok: true; ext: string; mime: string }
  | { ok: false; error: string };

/** Pure: validate mime + size for a user pantry photo upload. */
export function validatePantryUserImageUpload(opts: {
  mime: string | null | undefined;
  size: number;
}): PantryUserImageValidation {
  const mime = (opts.mime || "").toLowerCase().trim();
  const ext = PANTRY_USER_IMAGE_MIME[mime];
  if (!ext) {
    return {
      ok: false,
      error: "Image must be JPEG, PNG, WebP, or GIF.",
    };
  }
  if (!Number.isFinite(opts.size) || opts.size <= 0) {
    return { ok: false, error: "Empty image file." };
  }
  if (opts.size > PANTRY_USER_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Image must be ${PANTRY_USER_IMAGE_MAX_BYTES / (1024 * 1024)}MB or smaller.`,
    };
  }
  return { ok: true, ext, mime };
}

/** Absolute dir on disk for user-uploaded pantry images. */
export function pantryUserImagesDir(): string {
  return path.join(process.cwd(), "public", "pantry-images", "user");
}

/** Public URL path for a stored filename. */
export function pantryUserImagePublicPath(filename: string): string {
  return `/pantry-images/user/${filename}`;
}

/** True if url is a local /pantry-images/user/ path we manage. */
export function isManagedPantryUserImagePath(
  url: string | null | undefined
): boolean {
  return isUserPantryImage(url);
}

function filenameFromPublicPath(url: string): string | null {
  if (!isManagedPantryUserImagePath(url)) return null;
  return url.slice("/pantry-images/user/".length);
}

/** Write validated bytes; returns public path `/pantry-images/user/...`. */
export async function savePantryUserImageFile(
  bytes: Buffer,
  ext: string
): Promise<string> {
  const dir = pantryUserImagesDir();
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}${ext}`;
  await writeFile(path.join(dir, filename), bytes);
  return pantryUserImagePublicPath(filename);
}

/** Best-effort delete of a managed local user pantry image. */
export async function deleteManagedPantryUserImage(
  url: string | null | undefined
): Promise<void> {
  const name = url ? filenameFromPublicPath(url) : null;
  if (!name) return;
  await unlink(path.join(pantryUserImagesDir(), name)).catch(() => {});
}

/**
 * Who may set/clear a pantry item photo — same household scope as other
 * pantry mutations (guest null HH ↔ guest rows; member ↔ their HH).
 */
export function canEditPantryItemImage(
  item: { householdId: string | null },
  actor: { householdId: string | null }
): boolean {
  return rowMatchesScope(item.householdId, actor.householdId);
}
