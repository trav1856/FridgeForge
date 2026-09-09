import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { resolveHouseholdId } from "@/lib/auth";
import { recipeIsReadable } from "@/lib/recipe-request";
import { validateRecipeReview } from "@/lib/recipe-review";

type Ctx = { params: Promise<{ id: string }> };

function serializeReview(r: {
  id: string;
  recipeId: string;
  userId: string;
  stars: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  user?: { name: string | null; email: string } | null;
}) {
  const displayName =
    r.user?.name?.trim() ||
    (r.user?.email ? r.user.email.split("@")[0] : "Cook");
  return {
    id: r.id,
    recipeId: r.recipeId,
    userId: r.userId,
    stars: r.stars,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    authorName: displayName,
  };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id: recipeId } = await ctx.params;
    const householdId = await resolveHouseholdId();
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe || !recipeIsReadable(recipe, householdId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const user = await getCurrentUser();
    const reviews = await prisma.recipeReview.findMany({
      where: { recipeId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const mine = user
      ? reviews.find((r) => r.userId === user.id) ?? null
      : null;
    const avg =
      reviews.length === 0
        ? null
        : reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
    return NextResponse.json({
      reviews: reviews.map(serializeReview),
      mine: mine ? serializeReview(mine) : null,
      averageStars: avg,
      count: reviews.length,
      signedIn: Boolean(user),
    });
  } catch (err) {
    console.error("reviews GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const { id: recipeId } = await ctx.params;
    const householdId = await resolveHouseholdId();
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe || !recipeIsReadable(recipe, householdId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const validated = validateRecipeReview(body?.stars, body?.body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const review = await prisma.recipeReview.upsert({
      where: {
        recipeId_userId: { recipeId, userId: user.id },
      },
      create: {
        recipeId,
        userId: user.id,
        stars: validated.stars,
        body: validated.body,
      },
      update: {
        stars: validated.stars,
        body: validated.body,
      },
      include: { user: { select: { name: true, email: true } } },
    });
    return NextResponse.json({ review: serializeReview(review) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("reviews POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
