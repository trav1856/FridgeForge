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

/** Minimal recipe shape for image-reference checks. */
export type RecipeImageRefs = {
  imageUrl?: string | null;
  /** Raw DB JSON string (or parsed array) of story media items. */
  originStoryMedia?: unknown;
};

function storyMediaImageUrls(value: unknown): string[] {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const m of arr) {
    if (!m || typeof m !== "object") continue;
    const url = (m as { url?: unknown }).url;
    // Any item carrying a managed url counts as a reference (be conservative:
    // kind is not required, so a malformed-but-present reference still protects the file).
    if (typeof url === "string" && isManagedRecipeUserImagePath(url)) out.push(url);
  }
  return out;
}

/** Pure: managed /recipe-images/user/ files a recipe points at (main photo + story photos), deduped. */
export function managedImageUrlsForRecipe(recipe: RecipeImageRefs): string[] {
  const urls = [
    ...(isManagedRecipeUserImagePath(recipe.imageUrl) ? [recipe.imageUrl as string] : []),
    ...storyMediaImageUrls(recipe.originStoryMedia),
  ];
  return [...new Set(urls)];
}

const MANAGED_REF_IN_TEXT_RE = /\/recipe-images\/user\/([A-Za-z0-9._-]+)/g;

/** Conservative: any managed file named anywhere in a string (absolute URL, escaped JSON, …). */
function managedRefsInText(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  const text = value.replace(/\\\//g, "/"); // JSON-escaped slashes
  return [...text.matchAll(MANAGED_REF_IN_TEXT_RE)].map(
    (m) => `/recipe-images/user/${m[1]}`
  );
}

/**
 * Pure: which candidate files are NOT referenced by any of `others`
 * (their imageUrl or any story media item). Only these are safe to unlink.
 * References are matched conservatively (a managed filename appearing anywhere
 * in imageUrl or the story media JSON keeps the file).
 */
export function unreferencedManagedImageUrls(
  candidates: string[],
  others: RecipeImageRefs[]
): string[] {
  const referenced = new Set<string>();
  for (const r of others) {
    for (const u of managedImageUrlsForRecipe(r)) referenced.add(u);
    for (const u of managedRefsInText(r.imageUrl)) referenced.add(u);
    const media =
      typeof r.originStoryMedia === "string"
        ? r.originStoryMedia
        : JSON.stringify(r.originStoryMedia ?? null);
    for (const u of managedRefsInText(media)) referenced.add(u);
  }
  return [...new Set(candidates)].filter(
    (u) => isManagedRecipeUserImagePath(u) && !referenced.has(u)
  );
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


/**
 * Who may edit full recipe fields (title, ingredients, steps, …).
 * Owner only — stricter than photo edit (which also allows household members).
 * Guests and non-owners never get full edit.
 */
export function canEditRecipe(
  recipe: { ownerUserId: string | null; householdId: string | null },
  actor: { userId: string | null; householdId: string | null }
): boolean {
  if (!actor.userId) return false;
  return recipe.ownerUserId === actor.userId;
}
