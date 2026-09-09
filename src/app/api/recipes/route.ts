import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { householdWhere, recipeScopeWhere } from "@/lib/household";
import { stringifyArray } from "@/lib/json";
import { serializeRecipe } from "@/lib/mappers";
import { dedupeRecipesByTitle } from "@/lib/dedupe-recipes";
import {
  matchesTaxonomyFilters,
  normalizeCuisine,
  normalizeCourse,
  normalizeFoodCategories,
  normalizeOrigins,
} from "@/lib/recipe-taxonomy";

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
  cuisine: z.string().max(80).optional().nullable(),
  course: z.string().max(40).optional().nullable(),
  foodCategories: z.array(z.string()).optional(),
  origins: z.array(z.string()).optional(),
  originStory: z.string().max(4000).optional().nullable(),
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
  const q = req.nextUrl.searchParams.get("q");
  const cuisine = req.nextUrl.searchParams.get("cuisine");
  const course = req.nextUrl.searchParams.get("course");
  const foodCategory = req.nextUrl.searchParams.get("foodCategory");
  const origin =
    req.nextUrl.searchParams.get("origin") ||
    req.nextUrl.searchParams.get("ethnicity");

  // Default "All": shared catalog (householdId null) OR active household
  let where: Record<string, unknown> = {
    ...recipeScopeWhere(householdId),
    ...(struggle === "1" ? { isStruggleMeal: true } : {}),
  };

  if (scope === "mine" && user) {
    where = { ownerUserId: user.id };
  } else if (scope === "household") {
    // Household collection only (not the shared catalog)
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
      AND: [
        recipeScopeWhere(householdId),
        { favorites: { some: { userId: user.id } } },
      ],
    };
  }

  // Narrow cuisine/course in SQL when present; JSON arrays + search filtered in JS
  if (cuisine?.trim()) {
    where = { AND: [where, { cuisine: { equals: cuisine.trim(), mode: "insensitive" } }] };
  }
  if (course?.trim()) {
    where = { AND: [where, { course: { equals: course.trim(), mode: "insensitive" } }] };
  }

  const recipesRaw = await prisma.recipe.findMany({
    where,
    include: {
      ingredients: true,
      favorites: user
        ? { where: { userId: user.id }, select: { id: true } }
        : false,
    },
    orderBy: { title: "asc" },
  });
  const recipes = dedupeRecipesByTitle(recipesRaw, householdId);
  const filtered = recipes.filter((r) => {
    const serialized = serializeRecipe(r);
    return matchesTaxonomyFilters(
      {
        title: serialized.title,
        description: serialized.description,
        tags: serialized.tags,
        cuisine: serialized.cuisine,
        course: serialized.course,
        foodCategories: serialized.foodCategories,
        origins: serialized.origins,
        ingredients: serialized.ingredients,
      },
      { q, cuisine, course, foodCategory, origin }
    );
  });
  return NextResponse.json(
    filtered.map((r) => {
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
    const cuisine = normalizeCuisine(data.cuisine ?? null);
    const course = normalizeCourse(data.course ?? null);
    const foodCategories = normalizeFoodCategories(data.foodCategories);
    const origins = normalizeOrigins(data.origins);
    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        steps: stringifyArray(data.steps),
        costTier: data.costTier,
        tags: stringifyArray(data.tags),
        cuisine,
        course,
        foodCategories: stringifyArray(foodCategories),
        origins: stringifyArray(origins),
        originStory: data.originStory?.trim() || null,
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
