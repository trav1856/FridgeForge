import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const { id: recipeId } = await ctx.params;
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.recipeFavorite.findUnique({
      where: { userId_recipeId: { userId: user.id, recipeId } },
    });
    if (existing) {
      await prisma.recipeFavorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    }
    await prisma.recipeFavorite.create({
      data: { userId: user.id, recipeId },
    });
    return NextResponse.json({ favorited: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sign in to favorite" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ favorited: false });
  const { id: recipeId } = await ctx.params;
  const existing = await prisma.recipeFavorite.findUnique({
    where: { userId_recipeId: { userId: user.id, recipeId } },
  });
  return NextResponse.json({ favorited: Boolean(existing) });
}
