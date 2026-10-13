import { randomBytes } from "crypto";
import { copyFile, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { isManagedPantryUserImagePath, pantryUserImagesDir } from "@/lib/pantry-user-images";

/** Photos owned by SharedProduct ("shared") or HouseholdProductOverride ("household"). */
export type ProductImageKind = "shared" | "household";

const RE: Record<ProductImageKind, RegExp> = {
  shared: /^\/product-images\/shared\/[A-Za-z0-9._-]+\.webp$/,
  household: /^\/product-images\/household\/[A-Za-z0-9._-]+\.webp$/,
};

export function productImagesDir(kind: ProductImageKind): string {
  return path.join(process.cwd(), "public", "product-images", kind);
}

export function isManagedProductImage(
  url: string | null | undefined,
  kind?: ProductImageKind
): url is string {
  if (!url) return false;
  return kind ? RE[kind].test(url) : RE.shared.test(url) || RE.household.test(url);
}

function newName() {
  return `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.webp`;
}

/** Write already re-encoded WebP bytes. */
export async function saveProductImage(kind: ProductImageKind, webp: Buffer): Promise<string> {
  const dir = productImagesDir(kind);
  await mkdir(dir, { recursive: true });
  const name = newName();
  await writeFile(path.join(dir, name), webp, { mode: 0o644 });
  return `/product-images/${kind}/${name}`;
}

/**
 * Copy a household's own pantry photo into product storage, so the product
 * record keeps its photo when the pantry item's photo is replaced or removed.
 * Only re-encoded .webp pantry photos qualify. Returns null otherwise.
 */
export async function copyPantryPhotoToProduct(
  pantryUrl: string | null | undefined,
  kind: ProductImageKind
): Promise<string | null> {
  if (!pantryUrl || !isManagedPantryUserImagePath(pantryUrl) || !pantryUrl.endsWith(".webp")) {
    return null;
  }
  const src = path.join(pantryUserImagesDir(), pantryUrl.slice("/pantry-images/user/".length));
  const dir = productImagesDir(kind);
  await mkdir(dir, { recursive: true });
  const name = newName();
  try {
    await copyFile(src, path.join(dir, name));
  } catch {
    return null;
  }
  return `/product-images/${kind}/${name}`;
}

export async function deleteManagedProductImage(url: string | null | undefined) {
  if (!isManagedProductImage(url)) return;
  const kind: ProductImageKind = url.startsWith("/product-images/shared/") ? "shared" : "household";
  const name = url.slice(`/product-images/${kind}/`.length);
  await unlink(path.join(productImagesDir(kind), name)).catch(() => {});
}
