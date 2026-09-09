import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { serializeRecipe } from "@/lib/mappers";
import { stringifyArray } from "@/lib/json";
import {
  matchesTaxonomyFilters,
  normalizeCuisine,
  normalizeCourse,
  normalizeFoodCategories,
  normalizeOrigins,
} from "@/lib/recipe-taxonomy";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const take = Math.min(
      500,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 200) || 200)
    );
    const q = req.nextUrl.searchParams.get("q");
    const cuisine = req.nextUrl.searchParams.get("cuisine");
    const course = req.nextUrl.searchParams.get("course");
    const foodCategory = req.nextUrl.searchParams.get("foodCategory");
    const origin =
      req.nextUrl.searchParams.get("origin") ||
      req.nextUrl.searchParams.get("ethnicity");

    const recipes = await prisma.recipe.findMany({
      include: { ingredients: true, _count: { select: { reviews: true } } },
      orderBy: { updatedAt: "desc" },
      take,
    });
    const mapped = recipes.map((r) => ({
      ...serializeRecipe(r),
      reviewCount: r._count.reviews,
    }));
    const filtered = mapped.filter((r) =>
      matchesTaxonomyFilters(r, { q, cuisine, course, foodCategory, origin })
    );
    return NextResponse.json({ recipes: filtered });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/recipes GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  visibility: z.enum(["private", "household", "public"]).optional(),
  title: z.string().min(1).max(200).optional(),
  isStruggleMeal: z.boolean().optional(),
  cuisine: z.string().max(80).optional().nullable(),
  course: z.string().max(40).optional().nullable(),
  foodCategories: z.array(z.string()).optional(),
  origins: z.array(z.string()).optional(),
  originStory: z.string().max(4000).optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const data = patchSchema.parse(await req.json());
    const { id, foodCategories, origins, cuisine, course, tags, originStory, ...rest } = data;
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await prisma.recipe.update({
      where: { id },
      data: {
        ...rest,
        ...(cuisine !== undefined
          ? { cuisine: normalizeCuisine(cuisine) }
          : {}),
        ...(course !== undefined ? { course: normalizeCourse(course) } : {}),
        ...(foodCategories !== undefined
          ? { foodCategories: stringifyArray(normalizeFoodCategories(foodCategories)) }
          : {}),
        ...(origins !== undefined
          ? { origins: stringifyArray(normalizeOrigins(origins)) }
          : {}),
        ...(tags !== undefined ? { tags: stringifyArray(tags) } : {}),
        ...(originStory !== undefined
          ? { originStory: originStory?.trim() || null }
          : {}),
      },
      include: { ingredients: true },
    });
    return NextResponse.json(serializeRecipe(updated));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/recipes PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const data = deleteSchema.parse(await req.json());
    const existing = await prisma.recipe.findUnique({ where: { id: data.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.recipe.delete({ where: { id: data.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/recipes DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
