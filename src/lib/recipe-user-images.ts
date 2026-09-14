import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

/** Max upload size for user recipe photos (5 MiB). */
export const RECIPE_USER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const RECIPE_USER_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type RecipeUserImageValidation =
  | { ok: true; ext: string; mime: string }
  | { ok: false; error: string };

/** Pure: validate mime + size for a user recipe photo upload. */
export function validateRecipeUserImageUpload(opts: {
  mime: string | null | undefined;
  size: number;
}): RecipeUserImageValidation {
  const mime = (opts.mime || "").toLowerCase().trim();
  const ext = RECIPE_USER_IMAGE_MIME[mime];
  if (!ext) {
    return {
      ok: false,
      error: "Image must be JPEG, PNG, WebP, or GIF.",
    };
  }
  if (!Number.isFinite(opts.size) || opts.size <= 0) {
    return { ok: false, error: "Empty image file." };
  }
  if (opts.size > RECIPE_USER_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      error: `Image must be ${RECIPE_USER_IMAGE_MAX_BYTES / (1024 * 1024)}MB or smaller.`,
    };
  }
  return { ok: true, ext, mime };
}

/** Absolute dir on disk for user-uploaded recipe images. */
export function recipeUserImagesDir(): string {
  return path.join(process.cwd(), "public", "recipe-images", "user");
}

/** Public URL path for a stored filename. */
export function recipeUserImagePublicPath(filename: string): string {
  return `/recipe-images/user/${filename}`;
}

/** True if url is a local /recipe-images/user/ path we manage. */
export function isManagedRecipeUserImagePath(
  url: string | null | undefined
): boolean {
  if (!url) return false;
  return /^\/recipe-images\/user\/[A-Za-z0-9._-]+$/.test(url);
}

function filenameFromPublicPath(url: string): string | null {
  if (!isManagedRecipeUserImagePath(url)) return null;
  return url.slice("/recipe-images/user/".length);
}

/** Write validated bytes; returns public path `/recipe-images/user/...`. */
export async function saveRecipeUserImageFile(
  bytes: Buffer,
  ext: string
): Promise<string> {
  const dir = recipeUserImagesDir();
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}${ext}`;
  await writeFile(path.join(dir, filename), bytes);
  return recipeUserImagePublicPath(filename);
}

/** Best-effort delete of a managed local user recipe image. */
export async function deleteManagedRecipeUserImage(
  url: string | null | undefined
): Promise<void> {
  const name = url ? filenameFromPublicPath(url) : null;
  if (!name) return;
  await unlink(path.join(recipeUserImagesDir(), name)).catch(() => {});
}

/**
 * Who may set/clear a recipe photo — matches share manage + guest write rules:
 * - signed-in owner, or household member of the recipe's household
 * - guest (no user): guest-scoped recipes (householdId null) only
 */
export function canEditRecipeImage(
  recipe: { ownerUserId: string | null; householdId: string | null },
  actor: { userId: string | null; householdId: string | null }
): boolean {
  if (actor.userId) {
    if (recipe.ownerUserId === actor.userId) return true;
    if (
      actor.householdId != null &&
      recipe.householdId === actor.householdId
    ) {
      return true;
    }
    return false;
  }
  // Guest session: only recipes in guest scope (null household), same as DELETE write.
  return recipe.householdId == null;
}
