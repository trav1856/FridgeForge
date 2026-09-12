import { prisma } from "@/lib/db";

type RequestWithRecipe = {
  id: string;
  fromUserId: string;
  toUserId: string | null;
  status: string;
  recipe: {
    title: string;
    description: string | null;
    steps: string;
    costTier: string;
    tags: string;
    cuisine: string | null;
    course: string | null;
    foodCategories: string;
    origins: string;
    originStory: string | null;
    dishKey: string | null;
    servings: number;
    cookTimeMinutes: number | null;
    sourceUrl: string | null;
    imageUrl: string | null;
    isStruggleMeal: boolean;
    techniqueTips: string | null;
    flavorBoosters: string | null;
    ingredients: {
      name: string;
      quantity: number;
      unit: string;
      optional: boolean;
    }[];
  };
};

type LoadPendingResult =
  | { ok: true; request: RequestWithRecipe }
  | {
      ok: false;
      error: string;
      status: number;
      requestStatus?: string;
    };

export async function loadPendingOwnedRequest(
  id: string,
  ownerUserId: string
): Promise<LoadPendingResult> {
  const request = await prisma.recipeRequest.findUnique({
    where: { id },
    include: { recipe: { include: { ingredients: true } } },
  });
  if (!request) return { ok: false, error: "Not found", status: 404 };
  if (request.toUserId !== ownerUserId) {
    return { ok: false, error: "Not your request", status: 403 };
  }
  if (request.status !== "pending") {
    return {
      ok: false,
      error: "Already resolved",
      status: 409,
      requestStatus: request.status,
    };
  }
  return { ok: true, request: request as RequestWithRecipe };
}

async function cloneRecipeForRequester(request: RequestWithRecipe) {
  const fromUser = await prisma.user.findUnique({
    where: { id: request.fromUserId },
    include: {
      memberships: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  const requesterHouseholdId = fromUser?.memberships[0]?.householdId ?? null;
  const r = request.recipe;
  return prisma.recipe.create({
    data: {
      title: r.title,
      description: r.description,
      steps: r.steps,
      costTier: r.costTier,
      tags: r.tags,
      cuisine: r.cuisine,
      course: r.course,
      foodCategories: r.foodCategories,
      origins: r.origins,
      originStory: r.originStory,
      dishKey: r.dishKey,
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
}

/** Accept one pending request owned by `ownerUserId`. Returns clone recipe id. */
export async function acceptOwnedRecipeRequest(
  id: string,
  ownerUserId: string
): Promise<
  | { ok: true; recipeId: string }
  | { ok: false; error: string; status: number; requestStatus?: string }
> {
  const loaded = await loadPendingOwnedRequest(id, ownerUserId);
  if (!loaded.ok) {
    return {
      ok: false,
      error: loaded.error,
      status: loaded.status,
      requestStatus: loaded.requestStatus,
    };
  }
  const clone = await cloneRecipeForRequester(loaded.request);
  await prisma.recipeRequest.update({
    where: { id },
    data: { status: "accepted" },
  });
  return { ok: true, recipeId: clone.id };
}

export async function declineOwnedRecipeRequest(
  id: string,
  ownerUserId: string
): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number; requestStatus?: string }
> {
  const loaded = await loadPendingOwnedRequest(id, ownerUserId);
  if (!loaded.ok) {
    return {
      ok: false,
      error: loaded.error,
      status: loaded.status,
      requestStatus: loaded.requestStatus,
    };
  }
  await prisma.recipeRequest.update({
    where: { id },
    data: { status: "declined" },
  });
  return { ok: true };
}

/**
 * Accept every pending inbound request for `recipeId` addressed to the owner.
 * Processes sequentially so each requester gets their own household clone.
 */
export async function approveAllPendingForRecipe(
  recipeId: string,
  ownerUserId: string
): Promise<{ approved: number; recipeIds: string[] }> {
  const pending = await prisma.recipeRequest.findMany({
    where: {
      recipeId,
      toUserId: ownerUserId,
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const recipeIds: string[] = [];
  for (const row of pending) {
    const result = await acceptOwnedRecipeRequest(row.id, ownerUserId);
    if (result.ok) recipeIds.push(result.recipeId);
  }
  return { approved: recipeIds.length, recipeIds };
}

export async function countPendingIncomingForUser(
  userId: string
): Promise<number> {
  return prisma.recipeRequest.count({
    where: { toUserId: userId, status: "pending" },
  });
}
