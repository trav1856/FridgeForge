import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { stringifyArray } from "@/lib/json";
import { serializeRecipe } from "@/lib/mappers";

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default("each"),
  optional: z.boolean().optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  steps: z.array(z.string().min(1)).min(1),
  costTier: z.enum(["cheap", "moderate"]).default("cheap"),
  tags: z.array(z.string()).optional(),
  servings: z.number().int().positive().default(2),
  sourceUrl: z.string().url().optional().nullable(),
  isStruggleMeal: z.boolean().optional(),
  techniqueTips: z.array(z.string()).optional(),
  flavorBoosters: z.array(z.string()).optional(),
  ingredients: z.array(ingredientSchema).min(1),
});

export async function GET(req: NextRequest) {
  const struggle = req.nextUrl.searchParams.get("struggle");
  const recipes = await prisma.recipe.findMany({
    where: struggle === "1" ? { isStruggleMeal: true } : undefined,
    include: { ingredients: true },
    orderBy: { title: "asc" },
  });
  return NextResponse.json(recipes.map(serializeRecipe));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        steps: stringifyArray(data.steps),
        costTier: data.costTier,
        tags: stringifyArray(data.tags),
        servings: data.servings,
        sourceUrl: data.sourceUrl ?? null,
        isStruggleMeal: data.isStruggleMeal ?? data.tags?.includes("struggle") ?? false,
        techniqueTips: stringifyArray(data.techniqueTips),
        flavorBoosters: stringifyArray(data.flavorBoosters),
        ingredients: {
          create: data.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            optional: i.optional ?? false,
          })),
        },
      },
      include: { ingredients: true },
    });
    return NextResponse.json(serializeRecipe(recipe), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create recipe" }, { status: 500 });
  }
}
