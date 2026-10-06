import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { householdWhere } from "@/lib/household";
import { normalizeName } from "@/lib/normalize";
import { genericPantryImageForName } from "@/lib/pantry-images";
import { STARTER_STAPLES } from "@/lib/starter-staples";
import { requireWriteScope } from "@/lib/write-scope";

/**
 * POST — add the optional starter staples to the caller's own household.
 * Items already in the pantry (same name) are skipped, so it is safe to press twice.
 */
export async function POST() {
  const guard = await requireWriteScope("pantry");
  if (!guard.ok) return guard.response;
  const householdId = guard.scope.householdId;

  const existing = await prisma.pantryItem.findMany({
    where: householdWhere(householdId),
    select: { name: true },
  });
  const have = new Set(existing.map((e) => normalizeName(e.name)));
  const toAdd = STARTER_STAPLES.filter((s) => !have.has(normalizeName(s.name)));

  if (toAdd.length > 0) {
    await prisma.pantryItem.createMany({
      data: toAdd.map((s) => ({
        name: s.name,
        quantity: s.quantity,
        unit: s.unit,
        category: s.category,
        tags: JSON.stringify(["starter"]),
        imageUrl: genericPantryImageForName(s.name, s.category) ?? null,
        householdId,
      })),
    });
  }
  return NextResponse.json(
    { added: toAdd.length, skipped: STARTER_STAPLES.length - toAdd.length },
    { status: toAdd.length > 0 ? 201 : 200 }
  );
}
