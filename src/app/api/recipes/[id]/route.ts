import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/mappers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true },
  });
  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeRecipe(recipe));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await prisma.recipe.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
