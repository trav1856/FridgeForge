import { prisma } from "@/lib/db";
import { householdWhere } from "@/lib/household";
import { findCatalogItem } from "@/lib/pantry-catalog";
import { inferMeasureKind } from "@/lib/units";
import type { CustomStapleDTO } from "./custom-staples-shared";

export type { CustomStapleDTO } from "./custom-staples-shared";
export { mergeCatalogWithCustoms } from "./custom-staples-shared";

export function serializeCustomStaple(row: {
  id: string;
  name: string;
  category: string;
  measureKind: string | null;
  suggestedUnit: string | null;
  hidden: boolean;
  householdId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomStapleDTO {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    measureKind: row.measureKind,
    suggestedUnit: row.suggestedUnit,
    hidden: row.hidden,
    householdId: row.householdId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    custom: true,
  };
}

/**
 * Upsert a user-defined staple for the active household/guest scope.
 * Skips names that already exist in the static catalog (case-insensitive).
 * Category is whatever the user added under — not forced to Dairy.
 */
export async function upsertCustomStaple(
  input: {
    name: string;
    category: string;
    measureKind?: string | null;
    suggestedUnit?: string | null;
  },
  householdId: string | null
): Promise<CustomStapleDTO | null> {
  const name = input.name.trim();
  const category = input.category.trim();
  if (!name || !category) return null;
  if (findCatalogItem(name)) return null;

  const measureKind =
    input.measureKind?.trim() || inferMeasureKind(name, category);

  const candidates = await prisma.customPantryStaple.findMany({
    where: {
      ...householdWhere(householdId),
      category: { equals: category },
    },
  });
  const existing = candidates.find(
    (r) => r.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) {
    const updated = await prisma.customPantryStaple.update({
      where: { id: existing.id },
      data: {
        hidden: false,
        measureKind: measureKind || existing.measureKind,
        suggestedUnit: input.suggestedUnit ?? existing.suggestedUnit,
        name, // keep latest casing
      },
    });
    return serializeCustomStaple(updated);
  }

  const created = await prisma.customPantryStaple.create({
    data: {
      name,
      category,
      measureKind: measureKind || null,
      suggestedUnit: input.suggestedUnit ?? null,
      hidden: false,
      householdId,
    },
  });
  return serializeCustomStaple(created);
}

export async function listCustomStaples(
  householdId: string | null,
  opts?: { category?: string; includeHidden?: boolean }
): Promise<CustomStapleDTO[]> {
  const rows = await prisma.customPantryStaple.findMany({
    where: {
      ...householdWhere(householdId),
      ...(opts?.category ? { category: opts.category } : {}),
      ...(opts?.includeHidden ? {} : { hidden: false }),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(serializeCustomStaple);
}
