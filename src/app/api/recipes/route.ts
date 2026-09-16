import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { householdWhere } from "@/lib/household";
import {
  normalizeVisibility,
  recipeListAccessWhere,
} from "@/lib/recipe-visibility";
import { stringifyArray } from "@/lib/json";
import { serializeRecipe } from "@/lib/mappers";
import { dedupeRecipesByTitle } from "@/lib/dedupe-recipes";
import {
  getReviewStatsByRecipeIds,
  reviewStatsFor,
} from "@/lib/recipe-review-stats";
import {
  matchesTaxonomyFilters,
  normalizeCuisine,
  normalizeCourse,
  normalizeFoodCategories,
  normalizeOrigins,
} from "@/lib/recipe-taxonomy";
import { satisfiesHalal } from "@/lib/dietary";
import { inferAllergenTags } from "@/lib/allergens";

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
  kosherEligible: z.boolean().optional(),
  halalEligible: z.boolean().optional(),
  vegetarianEligible: z.boolean().optional(),
  pescatarianEligible: z.boolean().optional(),
  veganEligible: z.boolean().optional(),
  carnivoreEligible: z.boolean().optional(),
  atkinsEligible: z.boolean().optional(),
  lowCarbEligible: z.boolean().optional(),
  lowSugarEligible: z.boolean().optional(),
  lowSodiumEligible: z.boolean().optional(),
  kosherAdaptNote: z.string().max(500).optional().nullable(),
  halalAdaptNote: z.string().max(500).optional().nullable(),
  veganAdaptNote: z.string().max(500).optional().nullable(),
  vegetarianAdaptNote: z.string().max(500).optional().nullable(),
  allergenTags: z.array(z.string().max(64)).max(40).optional(),
  techniqueTips: z.array(z.string()).optional(),
  flavorBoosters: z.array(z.string()).optional(),
  visibility: z.enum(["global", "household", "shared", "public", "private"]).optional(),
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
  const dietary = req.nextUrl.searchParams.get("dietary"); // kosher | halal | vegan | vegetarian | pescatarian | carnivore | atkins | lowCarb | lowSugar | lowSodium
  const kosherOnly = dietary === "kosher" || req.nextUrl.searchParams.get("kosher") === "1";
  const halalOnly = dietary === "halal" || req.nextUrl.searchParams.get("halal") === "1";
  const veganOnly = dietary === "vegan" || req.nextUrl.searchParams.get("vegan") === "1";
  const vegetarianOnly = dietary === "vegetarian" || req.nextUrl.searchParams.get("vegetarian") === "1";
  const pescatarianOnly = dietary === "pescatarian" || req.nextUrl.searchParams.get("pescatarian") === "1";
  const carnivoreOnly = dietary === "carnivore" || req.nextUrl.searchParams.get("carnivore") === "1";
  const atkinsOnly = dietary === "atkins" || req.nextUrl.searchParams.get("atkins") === "1";
  const lowCarbOnly = dietary === "lowCarb" || dietary === "low-carb" || req.nextUrl.searchParams.get("lowCarb") === "1";
  const lowSugarOnly = dietary === "lowSugar" || dietary === "low-sugar" || req.nextUrl.searchParams.get("lowSugar") === "1";
  const lowSodiumOnly = dietary === "lowSodium" || dietary === "low-sodium" || req.nextUrl.searchParams.get("lowSodium") === "1";

  const accessWhere = recipeListAccessWhere({
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    householdId,
  });

  // Default "All": global catalog + accessible household/shared recipes
  const dietaryFilters: Record<string, unknown>[] = [];
  if (struggle === "1") dietaryFilters.push({ isStruggleMeal: true });
  if (kosherOnly) {
    dietaryFilters.push({
      OR: [
        { kosherEligible: true },
        { kosherAdaptNote: { not: null } },
      ],
    });
  }
  // Broaden SQL to halal OR kosher; refine with satisfiesHalal (kosher-no-alcohol) in JS
  if (halalOnly) {
    dietaryFilters.push({
      OR: [{ halalEligible: true }, { kosherEligible: true }],
    });
  }
  if (veganOnly) dietaryFilters.push({ veganEligible: true });
  if (vegetarianOnly) dietaryFilters.push({ vegetarianEligible: true });
  if (pescatarianOnly) dietaryFilters.push({ pescatarianEligible: true });
  if (carnivoreOnly) dietaryFilters.push({ carnivoreEligible: true });
  if (atkinsOnly) dietaryFilters.push({ atkinsEligible: true });
  if (lowCarbOnly) dietaryFilters.push({ lowCarbEligible: true });
  if (lowSugarOnly) dietaryFilters.push({ lowSugarEligible: true });
  if (lowSodiumOnly) dietaryFilters.push({ lowSodiumEligible: true });

  let where: Record<string, unknown> = {
    AND: [accessWhere, ...dietaryFilters],
  };

  if (scope === "mine" && user) {
    where = { ownerUserId: user.id };
  } else if (scope === "household") {
    // Household collection only (not the global catalog)
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
      AND: [accessWhere, { favorites: { some: { userId: user.id } } }],
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
    if (
      halalOnly &&
      !satisfiesHalal({
        halalEligible: serialized.halalEligible,
        kosherEligible: serialized.kosherEligible,
        title: serialized.title,
        description: serialized.description,
        tags: serialized.tags,
        ingredients: serialized.ingredients,
        steps: serialized.steps,
      })
    ) {
      return false;
    }
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
  const reviewStats = await getReviewStatsByRecipeIds(
    filtered.map((r) => r.id)
  );

  return NextResponse.json(
    filtered.map((r) => {
      const { favorites, ...rest } = r as typeof r & {
        favorites?: { id: string }[];
      };
      const stats = reviewStatsFor(reviewStats, r.id);
      return {
        ...serializeRecipe(rest),
        favorited: Array.isArray(favorites) ? favorites.length > 0 : false,
        averageStars: stats.averageStars,
        reviewCount: stats.reviewCount,
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
        kosherEligible: data.kosherEligible ?? false,
        halalEligible: data.halalEligible ?? false,
        vegetarianEligible: data.vegetarianEligible ?? false,
        pescatarianEligible: data.pescatarianEligible ?? false,
        veganEligible: data.veganEligible ?? false,
        carnivoreEligible: data.carnivoreEligible ?? false,
        atkinsEligible: data.atkinsEligible ?? false,
        lowCarbEligible: data.lowCarbEligible ?? false,
        lowSugarEligible: data.lowSugarEligible ?? false,
        lowSodiumEligible: data.lowSodiumEligible ?? false,
        kosherAdaptNote: data.kosherAdaptNote?.trim() || null,
        halalAdaptNote: data.halalAdaptNote?.trim() || null,
        allergenTags: stringifyArray(
          data.allergenTags && data.allergenTags.length
            ? data.allergenTags
            : inferAllergenTags({
                title: data.title,
                description: data.description,
                tags: data.tags,
                ingredients: data.ingredients,
                steps: data.steps,
              })
        ),
        veganAdaptNote: data.veganAdaptNote?.trim() || null,
        vegetarianAdaptNote: data.vegetarianAdaptNote?.trim() || null,
        techniqueTips: stringifyArray(data.techniqueTips),
        flavorBoosters: stringifyArray(data.flavorBoosters),
        visibility: data.visibility
          ? normalizeVisibility(data.visibility)
          : householdId
            ? "household"
            : "global",
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
