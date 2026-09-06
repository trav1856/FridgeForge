import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveHouseholdId } from "@/lib/auth";
import { upsertPantryItem } from "@/lib/pantry-upsert";

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().default(1),
  unit: z.string().min(1).max(40).default("each"),
  category: z.string().max(60).optional().nullable(),
  tags: z.array(z.string()).optional(),
  barcode: z.string().max(32).optional().nullable(),
  expirationDate: z.string().datetime().optional().nullable(),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const householdId = await resolveHouseholdId();
    const body = await req.json();
    const { items } = bodySchema.parse(body);
    const results = [];
    for (const item of items) {
      results.push(await upsertPantryItem({ ...item, lookupNutrition: false }, householdId));
    }
    return NextResponse.json({
      results,
      added: results.filter((r) => !r.merged).length,
      merged: results.filter((r) => r.merged).length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Bulk add failed" }, { status: 500 });
  }
}
