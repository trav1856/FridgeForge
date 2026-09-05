import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { stringifyArray } from "@/lib/json";
import { serializePantry } from "@/lib/mappers";
import { upsertPantryItem } from "@/lib/pantry-upsert";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().default(1),
  unit: z.string().min(1).max(40).default("each"),
  category: z.string().max(60).optional().nullable(),
  tags: z.array(z.string()).optional(),
  barcode: z.string().max(32).optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  merge: z.boolean().optional().default(true),
});

export async function GET() {
  const items = await prisma.pantryItem.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items.map(serializePantry));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    if (data.merge !== false) {
      const result = await upsertPantryItem(data);
      return NextResponse.json(result, { status: result.merged ? 200 : 201 });
    }

    const item = await prisma.pantryItem.create({
      data: {
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
        category: data.category ?? null,
        tags: stringifyArray(data.tags),
        barcode: data.barcode?.replace(/\D/g, "") || null,
        expirationDate: data.expirationDate
          ? new Date(data.expirationDate)
          : null,
      },
    });
    return NextResponse.json(
      { item: serializePantry(item), merged: false },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("pantry POST", err);
    const message = err instanceof Error ? err.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
