import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuthError, getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const { id } = await ctx.params;
    const { action } = actionSchema.parse(await req.json());

    const request = await prisma.recipeRequest.findUnique({
      where: { id },
      include: { recipe: { include: { ingredients: true } } },
    });
    if (!request) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (request.toUserId !== user.id) {
      return NextResponse.json({ error: "Not your request" }, { status: 403 });
    }
    if (request.status !== "pending") {
      return NextResponse.json(
        { error: "Already resolved", status: request.status },
        { status: 409 }
      );
    }

    if (action === "decline") {
      await prisma.recipeRequest.update({
        where: { id },
        data: { status: "declined" },
      });
      return NextResponse.json({ ok: true, status: "declined" });
    }

    // Accept: copy recipe + ingredients into the requester's household
    const fromUser = await prisma.user.findUnique({
      where: { id: request.fromUserId },
      include: {
        memberships: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
    const requesterHouseholdId =
      fromUser?.memberships[0]?.householdId ?? null;

    const r = request.recipe;
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
        visibility: "household",
        ownerUserId: request.fromUserId,
        householdId: requesterHouseholdId,
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

    await prisma.recipeRequest.update({
      where: { id },
      data: { status: "accepted" },
    });

    return NextResponse.json({
      ok: true,
      status: "accepted",
      recipeId: clone.id,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
