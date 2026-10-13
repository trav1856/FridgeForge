import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalBarcode } from "@/lib/barcode";
import {
  copyPantryPhotoToProduct,
  deleteManagedProductImage,
  isManagedProductImage,
} from "@/lib/product-images";

/**
 * Shared product records keyed by barcode.
 * - First save wins: the first household to save a barcode creates SharedProduct.
 * - Every later save that differs (any household, including the creator's)
 *   becomes a HouseholdProductOverride only that household sees.
 * - Scan prefill: household override → shared record → Open Food Facts.
 * Public responses go through toPublicProduct (allowlist); createdBy* never leaves
 * the server except in admin APIs.
 */

export type PublicProduct = {
  barcode: string;
  name: string;
  size: string | null;
  unit: string | null;
  category: string | null;
  imageUrl: string | null;
  source: "household" | "shared";
};

export const PUBLIC_PRODUCT_KEYS = ["barcode", "name", "size", "unit", "category", "imageUrl", "source"] as const;

type ProductFields = {
  barcode: string;
  name: string;
  size: string | null;
  unit: string | null;
  category: string | null;
  imageUrl: string | null;
};

/** Allowlist: only product info + photo. */
export function toPublicProduct(row: ProductFields, source: PublicProduct["source"]): PublicProduct {
  return {
    barcode: row.barcode,
    name: row.name,
    size: row.size ?? null,
    unit: row.unit ?? null,
    category: row.category ?? null,
    imageUrl: row.imageUrl ?? null,
    source,
  };
}

/** Prefill precedence: household override, then shared record, else null (caller falls back to OFF). */
export async function resolveProductForScan(
  barcodeInput: string,
  householdId: string | null
): Promise<PublicProduct | null> {
  const barcode = canonicalBarcode(barcodeInput);
  if (!barcode) return null;
  if (householdId) {
    const o = await prisma.householdProductOverride.findUnique({
      where: { householdId_barcode: { householdId, barcode } },
    });
    if (o) return toPublicProduct(o, "household");
  }
  const s = await prisma.sharedProduct.findUnique({ where: { barcode } });
  return s ? toPublicProduct(s, "shared") : null;
}

/** "8 oz" style size from a pantry quantity + unit. */
export function sizeFromPantry(quantity: number, unit: string): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const q = Math.round(quantity * 1000) / 1000;
  return `${q} ${unit || "each"}`.trim();
}

/** Parse a stored size back into quantity (for prefill). */
export function quantityFromSize(size: string | null | undefined): number | null {
  const m = String(size ?? "").match(/^\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export const SHARED_CREATE_LIMITS = { perHour: 20, perDay: 100 };

export type ContributeResult =
  | { result: "created"; product: PublicProduct }
  | { result: "override"; product: PublicProduct }
  | { result: "unchanged"; product: PublicProduct }
  | { result: "rate_limited" }
  | { result: "skipped"; reason: string };

function sameAs(a: Omit<ProductFields, "barcode">, b: Omit<ProductFields, "barcode">) {
  const n = (s: string | null) => (s ?? "").trim().toLowerCase();
  return (
    n(a.name) === n(b.name) &&
    n(a.size) === n(b.size) &&
    n(a.unit) === n(b.unit) &&
    n(a.category) === n(b.category) &&
    (a.imageUrl ?? null) === (b.imageUrl ?? null)
  );
}

export async function sharedCreatesAllowed(userId: string, now = new Date()): Promise<boolean> {
  const hourAgo = new Date(now.getTime() - 3600_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [h, d] = await Promise.all([
    prisma.sharedProduct.count({ where: { createdByUserId: userId, createdAt: { gte: hourAgo } } }),
    prisma.sharedProduct.count({ where: { createdByUserId: userId, createdAt: { gte: dayAgo } } }),
  ]);
  return h < SHARED_CREATE_LIMITS.perHour && d < SHARED_CREATE_LIMITS.perDay;
}

/**
 * Record a saved pantry item (already scoped to the caller's household) as
 * product info. Signed-in households only; guests never reach this.
 */
export async function contributeFromPantryItem(
  item: {
    name: string;
    quantity: number;
    unit: string;
    category: string | null;
    barcode: string | null;
    imageUrl: string | null;
  },
  actor: { userId: string; householdId: string }
): Promise<ContributeResult> {
  const barcode = canonicalBarcode(item.barcode);
  if (!barcode) return { result: "skipped", reason: "no valid barcode" };
  const fields = {
    name: item.name.trim().slice(0, 120),
    size: sizeFromPantry(item.quantity, item.unit),
    unit: item.unit || null,
    category: item.category ?? null,
  };

  const shared = await prisma.sharedProduct.findUnique({ where: { barcode } });
  if (!shared) {
    if (!(await sharedCreatesAllowed(actor.userId))) return { result: "rate_limited" };
    const photo = isManagedProductImage(item.imageUrl)
      ? item.imageUrl
      : await copyPantryPhotoToProduct(item.imageUrl, "shared");
    try {
      const created = await prisma.sharedProduct.create({
        data: {
          barcode,
          ...fields,
          imageUrl: photo,
          createdByUserId: actor.userId,
          createdByHouseholdId: actor.householdId,
        },
      });
      return { result: "created", product: toPublicProduct(created, "shared") };
    } catch (e) {
      if (photo && photo !== item.imageUrl) await deleteManagedProductImage(photo);
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      // Lost a race: someone else's first save won. Fall through to override.
      return contributeFromPantryItem(item, actor);
    }
  }

  const existing = await prisma.householdProductOverride.findUnique({
    where: { householdId_barcode: { householdId: actor.householdId, barcode } },
  });
  // Keep the photo the household already sees unless they took a new one.
  const ownPhoto = await copyPantryPhotoToProduct(item.imageUrl, "household");
  const imageUrl =
    ownPhoto ??
    (isManagedProductImage(item.imageUrl) ? item.imageUrl : existing?.imageUrl ?? shared.imageUrl ?? null);
  const next = { ...fields, imageUrl };
  const baseline = existing ?? shared;
  if (!ownPhoto && sameAs(next, baseline)) {
    return {
      result: "unchanged",
      product: toPublicProduct({ ...baseline, barcode }, existing ? "household" : "shared"),
    };
  }
  if (!existing && !ownPhoto && sameAs(next, shared)) {
    return { result: "unchanged", product: toPublicProduct(shared, "shared") };
  }
  const saved = await prisma.householdProductOverride.upsert({
    where: { householdId_barcode: { householdId: actor.householdId, barcode } },
    create: { householdId: actor.householdId, barcode, ...next },
    update: next,
  });
  if (existing?.imageUrl && existing.imageUrl !== saved.imageUrl && existing.imageUrl.startsWith("/product-images/household/")) {
    await deleteManagedProductImage(existing.imageUrl);
  }
  return { result: "override", product: toPublicProduct(saved, "household") };
}

// ---------- admin ----------

export type AdminProduct = ProductFields & {
  id: string;
  createdByUserId: string | null;
  createdByHouseholdId: string | null;
  createdAt: string;
  updatedAt: string;
  overrideCount: number;
};

export async function listSharedProductsForAdmin(q: string, take = 50): Promise<AdminProduct[]> {
  const term = q.trim();
  const rows = await prisma.sharedProduct.findMany({
    where: term
      ? { OR: [{ barcode: { contains: term.replace(/\D/g, "") || term } }, { name: { contains: term, mode: "insensitive" } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
  const counts = await prisma.householdProductOverride.groupBy({
    by: ["barcode"],
    where: { barcode: { in: rows.map((r) => r.barcode) } },
    _count: { _all: true },
  });
  const byCode = new Map(counts.map((c) => [c.barcode, c._count._all]));
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    overrideCount: byCode.get(r.barcode) ?? 0,
  }));
}

/**
 * When a shared photo goes away, pantry items that showed it fall back to the
 * normal generic/category picture instead of a dead link.
 */
export async function detachSharedPhoto(url: string | null) {
  if (!url) return;
  await prisma.pantryItem.updateMany({ where: { imageUrl: url }, data: { imageUrl: null } });
  await prisma.householdProductOverride.updateMany({ where: { imageUrl: url }, data: { imageUrl: null } });
  await deleteManagedProductImage(url);
}
