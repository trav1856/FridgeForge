import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AuthError,
  getActiveHouseholdId,
  getCurrentUser,
} from "@/lib/auth";
import { canRequestRecipe } from "@/lib/recipe-request";
import { countPendingIncomingForUser } from "@/lib/recipe-request-actions";

const createSchema = z.object({
  recipeId: z.string().min(1),
  message: z.string().max(280).optional(),
});

async function resolveOwnerUserId(
  recipe: {
    ownerUserId: string | null;
    householdId: string | null;
  }
): Promise<string | null> {
  if (recipe.ownerUserId) return recipe.ownerUserId;
  if (!recipe.householdId) return null;
  const owner = await prisma.householdMember.findFirst({
    where: { householdId: recipe.householdId, role: "owner" },
    orderBy: { createdAt: "asc" },
  });
  if (owner) return owner.userId;
  const any = await prisma.householdMember.findFirst({
    where: { householdId: recipe.householdId },
    orderBy: { createdAt: "asc" },
  });
  return any?.userId ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const box = req.nextUrl.searchParams.get("box") || "incoming";

    if (box === "pending-count") {
      const pendingCount = await countPendingIncomingForUser(user.id);
      return NextResponse.json({ pendingCount });
    }

    if (box === "outgoing") {
      const requests = await prisma.recipeRequest.findMany({
        where: { fromUserId: user.id },
        include: {
          recipe: { select: { id: true, title: true } },
          toUser: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ requests });
    }

    const requests = await prisma.recipeRequest.findMany({
      where: { toUserId: user.id },
      include: {
        recipe: { select: { id: true, title: true } },
        fromUser: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const pendingCount = requests.filter((r) => r.status === "pending").length;
    return NextResponse.json({ requests, pendingCount });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to list" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError();
    const body = createSchema.parse(await req.json());
    const recipe = await prisma.recipe.findUnique({
      where: { id: body.recipeId },
    });
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const householdId = getActiveHouseholdId(user);
    if (
      !canRequestRecipe(
        {
          id: recipe.id,
          householdId: recipe.householdId,
          ownerUserId: recipe.ownerUserId,
          visibility: recipe.visibility,
        },
        { userId: user.id, householdId }
      )
    ) {
      return NextResponse.json(
        { error: "Cannot request this recipe" },
        { status: 400 }
      );
    }

    const toUserId = await resolveOwnerUserId(recipe);
    if (!toUserId) {
      return NextResponse.json(
        { error: "No owner to request from" },
        { status: 400 }
      );
    }
    if (toUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot request your own recipe" },
        { status: 400 }
      );
    }

    const existing = await prisma.recipeRequest.findFirst({
      where: {
        recipeId: recipe.id,
        fromUserId: user.id,
        status: "pending",
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You already have a pending request", request: existing },
        { status: 409 }
      );
    }

    const request = await prisma.recipeRequest.create({
      data: {
        recipeId: recipe.id,
        fromUserId: user.id,
        toUserId,
        householdId: recipe.householdId,
        message: body.message?.trim() || "Can I have that recipe?",
        status: "pending",
      },
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Sign in to request" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
