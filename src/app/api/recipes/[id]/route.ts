import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { recipeRowMatchesScope } from "@/lib/household";
import { recipeIsReadable } from "@/lib/recipe-request";
import { serializeRecipe } from "@/lib/mappers";
import { normalizeVisibility } from "@/lib/recipe-visibility";
import {
  ensureParentCuisineOrigins,
  normalizeCuisine,
  normalizeMeatType,
  resolveTaxonomyForWrite,
} from "@/lib/recipe-taxonomy";
import { parseStringArray, stringifyArray } from "@/lib/json";
import { inferAllergenTags } from "@/lib/allergens";
import { canEditRecipe } from "@/lib/recipe-user-images";
import { dishKeyForTitle } from "@/lib/dish-key";
import { sanitizeRecipeWritePayload } from "@/lib/sanitize-recipe-text";

type Ctx = { params: Promise<{ id: string }> };

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive().default(1),
  unit: z.string().default("each"),
  optional: z.boolean().optional(),
});

const patchSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  steps: z.array(z.string().min(1)).min(1),
  costTier: z.enum(["cheap", "moderate"]).default("cheap"),
  tags: z.array(z.string()).optional(),
  cuisine: z.string().max(80).optional().nullable(),
  course: z.string().max(40).optional().nullable(),
  foodCategories: z.array(z.string()).optional(),
  origins: z.array(z.string()).optional(),
  meatType: z.string().max(40).optional().nullable(),
  originStory: z.string().max(4000).optional().nullable(),
  servings: z.number().int().positive().default(2),
  cookTimeMinutes: z.number().int().positive().optional().nullable(),
  sourceUrl: z.string().url().optional().nullable().or(z.literal("")).or(z.null()),
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
  visibility: z
    .enum(["global", "household", "shared", "public", "private"])
    .optional(),
  ingredients: z.array(ingredientSchema).min(1),
});

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const householdId = await resolveHouseholdId();
  const user = await getCurrentUser();
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: true,
      shares: {
        select: {
          id: true,
          toUserId: true,
          toUserEmail: true,
          toHouseholdId: true,
          accepted: true,
          createdAt: true,
          toUser: { select: { id: true, email: true, name: true } },
          toHousehold: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (
    !recipe ||
    !recipeIsReadable(recipe, householdId, {
      userId: user?.id,
      userEmail: user?.email,
    })
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { shares, ...rest } = recipe;
  const canManageShares =
    Boolean(user) &&
    (recipe.ownerUserId === user?.id ||
      (householdId != null && recipe.householdId === householdId));
  return NextResponse.json({
    ...serializeRecipe(rest),
    shares: canManageShares ? shares : undefined,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const householdId = await resolveHouseholdId();
    const existing = await prisma.recipe.findUnique({
      where: { id },
      include: { ingredients: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Household-scoped: must be readable in current household context
    if (
      !recipeIsReadable(existing, householdId, {
        userId: user.id,
        userEmail: user.email,
      })
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      !canEditRecipe(
        { ownerUserId: existing.ownerUserId, householdId: existing.householdId },
        { userId: user.id, householdId }
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Quick owner updates: visibility / cuisine / meatType (card + detail controls)
    const bodyKeys =
      body && typeof body === "object" && !Array.isArray(body)
        ? Object.keys(body as object)
        : [];
    const quickKeys = new Set(["visibility", "cuisine", "meatType"]);
    if (bodyKeys.length > 0 && bodyKeys.every((k) => quickKeys.has(k))) {
      const quick = z
        .object({
          visibility: z
            .enum(["global", "household", "shared", "public", "private"])
            .optional(),
          cuisine: z.string().max(80).nullable().optional(),
          meatType: z.string().max(40).nullable().optional(),
        })
        .safeParse(body);
      if (quick.success) {
        const dataQuick: {
          visibility?: string;
          cuisine?: string | null;
          meatType?: string | null;
          foodCategories?: string;
          origins?: string;
        } = {};
        if (quick.data.visibility !== undefined) {
          dataQuick.visibility = normalizeVisibility(quick.data.visibility);
        }
        if (quick.data.cuisine !== undefined) {
          const c = normalizeCuisine(quick.data.cuisine);
          dataQuick.cuisine = c;
          if (c) {
            const nextOrigins = ensureParentCuisineOrigins(
              c,
              parseStringArray(existing.origins)
            );
            dataQuick.origins = JSON.stringify(nextOrigins);
          }
        }
        if (quick.data.meatType !== undefined) {
          const mt = normalizeMeatType(quick.data.meatType);
          dataQuick.meatType = mt;
          if (mt) {
            const cats = parseStringArray(existing.foodCategories);
            if (!cats.map((c) => c.toLowerCase()).includes("meat")) {
              dataQuick.foodCategories = JSON.stringify([...cats, "meat"]);
            }
          }
        }
        const updated = await prisma.recipe.update({
          where: { id },
          data: dataQuick,
          include: { ingredients: true },
        });
        return NextResponse.json(serializeRecipe(updated));
      }
    }

    const data = sanitizeRecipeWritePayload(patchSchema.parse(body));
    const tax = resolveTaxonomyForWrite({
      title: data.title,
      description: data.description,
      tags: data.tags,
      ingredients: data.ingredients,
      steps: data.steps,
      cuisine: data.cuisine,
      course: data.course,
      foodCategories: data.foodCategories,
      origins: data.origins,
      meatType: data.meatType,
    });
    const sourceUrl =
      data.sourceUrl === "" || data.sourceUrl == null
        ? null
        : data.sourceUrl;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      return tx.recipe.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description ?? null,
          steps: stringifyArray(data.steps),
          costTier: data.costTier,
          tags: stringifyArray(data.tags),
          cuisine: tax.cuisine,
          course: tax.course,
          foodCategories: stringifyArray(tax.foodCategories),
          origins: stringifyArray(tax.origins),
          meatType: tax.meatType,
          originStory: data.originStory?.trim() || null,
          servings: data.servings,
          cookTimeMinutes: data.cookTimeMinutes ?? null,
          sourceUrl,
          ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
          isStruggleMeal:
            data.isStruggleMeal ?? data.tags?.includes("struggle") ?? false,
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
          veganAdaptNote: data.veganAdaptNote?.trim() || null,
          vegetarianAdaptNote: data.vegetarianAdaptNote?.trim() || null,
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
          techniqueTips: stringifyArray(data.techniqueTips),
          flavorBoosters: stringifyArray(data.flavorBoosters),
          ...(data.visibility !== undefined
            ? { visibility: normalizeVisibility(data.visibility) }
            : {}),
          dishKey: dishKeyForTitle(data.title),
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
    });

    return NextResponse.json(serializeRecipe(updated));
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("recipes/[id] PATCH", err);
    return NextResponse.json({ error: "Failed to update recipe" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const householdId = await resolveHouseholdId();
    const recipe = await prisma.recipe.findUnique({ where: { id } });
    if (!recipe || !recipeRowMatchesScope(recipe.householdId, householdId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Guests cannot delete shared catalog; only exact household (or guest-owned null) rows
    if (recipe.householdId == null && householdId != null) {
      return NextResponse.json(
        { error: "Cannot delete shared catalog recipe" },
        { status: 403 }
      );
    }
    await prisma.recipe.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
