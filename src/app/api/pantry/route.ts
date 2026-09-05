import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { stringifyArray } from "@/lib/json";
import { serializePantry } from "@/lib/mappers";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().default(1),
  unit: z.string().min(1).max(40).default("each"),
  category: z.string().max(60).optional().nullable(),
  tags: z.array(z.string()).optional(),
  expirationDate: z.string().datetime().optional().nullable(),
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
    const item = await prisma.pantryItem.create({
      data: {
        name: data.name,
        quantity: data.quantity,
        unit: data.unit,
        category: data.category ?? null,
        tags: stringifyArray(data.tags),
        expirationDate: data.expirationDate
          ? new Date(data.expirationDate)
          : null,
      },
    });
    return NextResponse.json(serializePantry(item), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
