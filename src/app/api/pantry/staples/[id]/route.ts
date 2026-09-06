import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveHouseholdId } from "@/lib/auth";
import { rowMatchesScope } from "@/lib/household";
import { serializeCustomStaple } from "@/lib/custom-staples";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  hidden: z.boolean().optional(),
  measureKind: z.string().max(40).optional().nullable(),
  suggestedUnit: z.string().max(40).optional().nullable(),
  name: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(60).optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const householdId = await resolveHouseholdId();
    const row = await prisma.customPantryStaple.findUnique({ where: { id } });
    if (!row || !rowMatchesScope(row.householdId, householdId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = patchSchema.parse(await req.json());
    const updated = await prisma.customPantryStaple.update({
      where: { id },
      data: {
        ...(data.hidden !== undefined ? { hidden: data.hidden } : {}),
        ...(data.measureKind !== undefined
          ? { measureKind: data.measureKind }
          : {}),
        ...(data.suggestedUnit !== undefined
          ? { suggestedUnit: data.suggestedUnit }
          : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.category !== undefined
          ? { category: data.category.trim() }
          : {}),
      },
    });
    return NextResponse.json(serializeCustomStaple(updated));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("staples PATCH", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const householdId = await resolveHouseholdId();
  const row = await prisma.customPantryStaple.findUnique({ where: { id } });
  if (!row || !rowMatchesScope(row.householdId, householdId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Soft-hide by default for history; hard delete if already hidden.
  if (!row.hidden) {
    const updated = await prisma.customPantryStaple.update({
      where: { id },
      data: { hidden: true },
    });
    return NextResponse.json(serializeCustomStaple(updated));
  }
  await prisma.customPantryStaple.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
