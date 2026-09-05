import { prisma } from "@/lib/db";
import { stringifyArray } from "@/lib/json";
import { normalizeName } from "@/lib/normalize";
import { serializePantry } from "@/lib/mappers";

export type UpsertPantryInput = {
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  tags?: string[];
  barcode?: string | null;
  expirationDate?: string | null;
};

/** Create or merge into an existing pantry row (same barcode, else same normalized name+unit). */
export async function upsertPantryItem(data: UpsertPantryInput) {
  const barcode = data.barcode?.replace(/\D/g, "") || null;

  let existing = null as Awaited<
    ReturnType<typeof prisma.pantryItem.findFirst>
  >;

  if (barcode) {
    existing = await prisma.pantryItem.findFirst({ where: { barcode } });
  }

  if (!existing) {
    const all = await prisma.pantryItem.findMany();
    const target = normalizeName(data.name);
    existing =
      all.find(
        (i) =>
          normalizeName(i.name) === target &&
          i.unit.toLowerCase() === data.unit.toLowerCase()
      ) ?? null;
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
    },
  });
  return { item: serializePantry(created), merged: false as const };
}
