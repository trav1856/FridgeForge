import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";

export async function GET() {
  try {
    await requireAdmin();
    const [users, recipes, reviews, households, pantryItems] = await Promise.all([
      prisma.user.count(),
      prisma.recipe.count(),
      prisma.recipeReview.count(),
      prisma.household.count(),
      prisma.pantryItem.count(),
    ]);
    const admins = await prisma.user.count({ where: { role: "admin" } });
    const publicRecipes = await prisma.recipe.count({
      where: { visibility: { in: ["public", "global"] } },
    });
    return NextResponse.json({
      users,
      admins,
      recipes,
      publicRecipes,
      reviews,
      households,
      pantryItems,
    });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/stats", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
