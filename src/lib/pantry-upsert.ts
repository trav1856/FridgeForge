import { prisma } from "@/lib/db";
import { householdWhere } from "@/lib/household";
import { stringifyArray } from "@/lib/json";
import { normalizeName } from "@/lib/normalize";
import { serializePantry } from "@/lib/mappers";
import {
  searchProductByName,
  stringifyNutrition,
} from "@/lib/open-food-facts";
import {
  genericPantryImageForName,
  prefersGenericPantryImage,
} from "@/lib/pantry-images";

export type UpsertPantryInput = {
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  tags?: string[];
  barcode?: string | null;
  expirationDate?: string | null;
  nutritionJson?: string | null;
  imageUrl?: string | null;
  /** When true (default), best-effort OFF name lookup if nutritionJson missing. */
  lookupNutrition?: boolean;
};

/** Create or merge into an existing pantry row (same barcode, else same normalized name+unit). */
export async function upsertPantryItem(
  data: UpsertPantryInput,
  householdId: string | null = null
) {
  const barcode = data.barcode?.replace(/\D/g, "") || null;
  const scope = householdWhere(householdId);

  let existing = null as Awaited<
    ReturnType<typeof prisma.pantryItem.findFirst>
  >;

  if (barcode) {
    existing = await prisma.pantryItem.findFirst({
      where: { ...scope, barcode },
    });
  }

  if (!existing) {
    const all = await prisma.pantryItem.findMany({ where: scope });
    const target = normalizeName(data.name);
    existing =
      all.find(
        (i) =>
          normalizeName(i.name) === target &&
          i.unit.toLowerCase() === data.unit.toLowerCase()
      ) ?? null;
  }

  const genericImage = genericPantryImageForName(
    data.name,
    data.category ?? existing?.category ?? null
  );

  let nutritionJson = data.nutritionJson ?? null;
  let imageUrl = data.imageUrl?.trim() || null;

  // Curated generic for staples when caller did not pass a brand/OFF image.
  if (!imageUrl) {
    imageUrl = prefersGenericPantryImage(data.name) ? genericImage : null;
  }

  const needsOffLookup =
    data.lookupNutrition !== false &&
    (!nutritionJson || (!imageUrl && !prefersGenericPantryImage(data.name))) &&
    !existing?.nutritionJson;

  if (needsOffLookup) {
    try {
      const hit = await searchProductByName(data.name);
      if (!nutritionJson && hit?.nutrition) {
        nutritionJson = stringifyNutrition(hit.nutrition);
      }
      // Brand/OFF image only when we don't already have one and this isn't a
      // curated generic staple (avoid random brand carton for "milk").
      if (
        !imageUrl &&
        !prefersGenericPantryImage(data.name) &&
        hit?.imageUrl
      ) {
        imageUrl = hit.imageUrl;
      }
    } catch {
      /* best-effort */
    }
  }

  if (!imageUrl) {
    imageUrl = genericImage;
  }

  if (existing) {
    const updated = await prisma.pantryItem.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + data.quantity,
        ...(data.category !== undefined && {
          category: data.category ?? existing.category,
        }),
        ...(data.tags !== undefined && { tags: stringifyArray(data.tags) }),
        ...(barcode && !existing.barcode && { barcode }),
        ...(data.expirationDate !== undefined && {
          expirationDate: data.expirationDate
            ? new Date(data.expirationDate)
            : existing.expirationDate,
        }),
        ...(!existing.nutritionJson &&
          nutritionJson && { nutritionJson }),
        ...(!existing.imageUrl && imageUrl && { imageUrl }),
      },
    });
    return { item: serializePantry(updated), merged: true as const };
  }

  const created = await prisma.pantryItem.create({
    data: {
      name: data.name,
      quantity: data.quantity,
      unit: data.unit,
      category: data.category ?? null,
      tags: stringifyArray(data.tags),
      barcode,
      expirationDate: data.expirationDate
        ? new Date(data.expirationDate)
        : null,
      nutritionJson,
      imageUrl: imageUrl ?? null,
      householdId,
    },
  });
  return { item: serializePantry(created), merged: false as const };
}


/**
 * Move guest/null-scoped *scanned* pantry rows (those with a barcode) into the
 * active household. Seed staples without barcodes stay on null for guests.
 * Returns how many rows were claimed.
 */
export async function claimOrphanBarcodePantry(
  householdId: string
): Promise<number> {
  if (!householdId) return 0;
  const result = await prisma.pantryItem.updateMany({
    where: {
      householdId: null,
      barcode: { not: null },
    },
    data: { householdId },
  });
  return result.count;
}
