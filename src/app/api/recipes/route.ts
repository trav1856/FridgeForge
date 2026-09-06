import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { householdWhere } from "@/lib/household";
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
  cookTimeMinutes: z.number().int().positive().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  isStruggleMeal: z.boolean().optional(),
  techniqueTips: z.array(z.string()).optional(),
  flavorBoosters: z.array(z.string()).optional(),
  ingredients: z.array(ingredientSchema).min(1),
});

export async function GET(req: NextRequest) {
  const householdId = await resolveHouseholdId();
  const user = await getCurrentUser();
  const struggle = req.nextUrl.searchParams.get("struggle");
  const favoritesOnly = req.nextUrl.searchParams.get("favorites") === "1";
  const scope = req.nextUrl.searchParams.get("scope"); // mine | household | (default all in scope)

  let where: Record<string, unknown> = {
    ...householdWhere(householdId),
    ...(struggle === "1" ? { isStruggleMeal: true } : {}),
  };

  if (scope === "mine" && user) {
    where = { ownerUserId: user.id };
  } else if (scope === "household") {
    where = {
      ...householdWhere(householdId),
      ...(householdId != null
        ? {}
        : { householdId: null, ownerUserId: null }),
    };
  }

  if (favoritesOnly) {
    if (!user) {
      return NextResponse.json([]);
    }
    where = {
      favorites: { some: { userId: user.id } },
    };
  }

  const recipes = await prisma.recipe.findMany({
    where,
    include: {
      ingredients: true,
      favorites: user
        ? { where: { userId: user.id }, select: { id: true } }
        : false,
    },
    orderBy: { title: "asc" },
  });
  return NextResponse.json(
    recipes.map((r) => {
      const { favorites, ...rest } = r as typeof r & {
        favorites?: { id: string }[];
      };
      return {
        ...serializeRecipe(rest),
        favorited: Array.isArray(favorites) ? favorites.length > 0 : false,
      };
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    const householdId = await resolveHouseholdId();
    const body = await req.json();
    const data = createSchema.parse(body);
    const user = await getCurrentUser();
    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        steps: stringifyArray(data.steps),
        costTier: data.costTier,
        tags: stringifyArray(data.tags),
        servings: data.servings,
        cookTimeMinutes: data.cookTimeMinutes ?? null,
        sourceUrl: data.sourceUrl ?? null,
        imageUrl: data.imageUrl ?? null,
        isStruggleMeal: data.isStruggleMeal ?? data.tags?.includes("struggle") ?? false,
        techniqueTips: stringifyArray(data.techniqueTips),
        flavorBoosters: stringifyArray(data.flavorBoosters),
        visibility: householdId ? "household" : "private",
        ownerUserId: user?.id ?? null,
        householdId,
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
