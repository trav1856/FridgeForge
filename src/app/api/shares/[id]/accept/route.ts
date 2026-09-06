import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError, getActiveHouseholdId, getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const { id } = await ctx.params;
    const share = await prisma.recipeShare.findUnique({
      where: { id },
      include: { recipe: { include: { ingredients: true } } },
    });
    if (!share) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const emailOk =
      share.toUserId === user.id ||
      (share.toUserEmail &&
        share.toUserEmail.toLowerCase() === user.email.toLowerCase());
    if (!emailOk) {
      return NextResponse.json({ error: "Not your share" }, { status: 403 });
    }
    if (share.accepted) {
      return NextResponse.json({ ok: true, already: true });
    }

    const householdId = getActiveHouseholdId(user);
    const r = share.recipe;
    const clone = await prisma.recipe.create({
      data: {
        title: r.title,
        description: r.description,
        steps: r.steps,
        costTier: r.costTier,
        tags: r.tags,
        servings: r.servings,
        cookTimeMinutes: r.cookTimeMinutes,
        sourceUrl: r.sourceUrl,
        imageUrl: r.imageUrl,
        isStruggleMeal: r.isStruggleMeal,
        techniqueTips: r.techniqueTips,
        flavorBoosters: r.flavorBoosters,
        visibility: "private",
        ownerUserId: user.id,
        householdId,
        ingredients: {
          create: r.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            optional: i.optional,
          })),
        },
      },
    });

    await prisma.recipeShare.update({
      where: { id: share.id },
      data: {
        accepted: true,
        acceptedAt: new Date(),
        toUserId: user.id,
      },
    });

    return NextResponse.json({ ok: true, recipeId: clone.id });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Accept failed" }, { status: 500 });
  }
}
