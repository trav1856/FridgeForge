import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { stringifyArray } from "@/lib/json";
import { serializePantry } from "@/lib/mappers";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).max(40).optional(),
  category: z.string().max(60).optional().nullable(),
  tags: z.array(z.string()).optional(),
  barcode: z.string().max(32).optional().nullable(),
  expirationDate: z.string().datetime().optional().nullable(),
  nutritionJson: z.string().max(4000).optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data = updateSchema.parse(body);
    const item = await prisma.pantryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: stringifyArray(data.tags) }),
        ...(data.barcode !== undefined && {
          barcode: data.barcode?.replace(/\D/g, "") || null,
        }),
        ...(data.expirationDate !== undefined && {
          expirationDate: data.expirationDate
            ? new Date(data.expirationDate)
            : null,
        }),
        ...(data.nutritionJson !== undefined && {
          nutritionJson: data.nutritionJson,
        }),
      },
    });
    return NextResponse.json(serializePantry(item));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await prisma.pantryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
