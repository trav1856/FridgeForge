import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveHouseholdId } from "@/lib/auth";
import { householdWhere } from "@/lib/household";
import { stringifyArray } from "@/lib/json";
import { serializePantry } from "@/lib/mappers";
import { upsertPantryItem } from "@/lib/pantry-upsert";
import {
  searchNutritionByName,
  stringifyNutrition,
} from "@/lib/open-food-facts";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().default(1),
  unit: z.string().min(1).max(40).default("each"),
  category: z.string().max(60).optional().nullable(),
  tags: z.array(z.string()).optional(),
  barcode: z.string().max(32).optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  nutritionJson: z.string().max(4000).optional().nullable(),
  merge: z.boolean().optional().default(true),
});

export async function GET() {
  const householdId = await resolveHouseholdId();
  const items = await prisma.pantryItem.findMany({
    where: householdWhere(householdId),
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(items.map(serializePantry));
}

export async function POST(req: NextRequest) {
  try {
    const householdId = await resolveHouseholdId();
    const body = await req.json();
    const data = createSchema.parse(body);

    if (data.merge !== false) {
      const result = await upsertPantryItem(data, householdId);
      return NextResponse.json(result, { status: result.merged ? 200 : 201 });
    }

    let nutritionJson = data.nutritionJson ?? null;
    if (!nutritionJson) {
      try {
        const snap = await searchNutritionByName(data.name);
        nutritionJson = stringifyNutrition(snap);
      } catch {
        nutritionJson = null;
      }
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
        nutritionJson,
        householdId,
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
