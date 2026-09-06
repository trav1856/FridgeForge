import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

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
    await prisma.shoppingListItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
