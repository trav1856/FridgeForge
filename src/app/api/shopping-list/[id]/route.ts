import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveHouseholdId, getCurrentUser } from "@/lib/auth";
import { shoppingRowMatchesScope } from "@/lib/household";

/** Load the row and check it belongs to the caller's list scope (same as GET). */
async function loadOwnedItem(id: string) {
  const user = await getCurrentUser();
  const actor = {
    householdId: getActiveHouseholdId(user),
    userId: user?.id ?? null,
  };
  const row = await prisma.shoppingListItem.findUnique({
    where: { id },
    select: { id: true, householdId: true, userId: true },
  });
  if (!row || !shoppingRowMatchesScope(row, actor)) return null;
  return row;
}

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  checked: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!(await loadOwnedItem(id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const data = patchSchema.parse(await req.json());
    const item = await prisma.shoppingListItem.update({
      where: { id },
      data,
    });
    return NextResponse.json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!(await loadOwnedItem(id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.shoppingListItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
