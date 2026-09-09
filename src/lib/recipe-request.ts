/**
 * Social-lite recipe request rules (pure helpers for API + UI + tests).
 */

export type RequestableRecipe = {
  id: string;
  householdId: string | null;
  ownerUserId: string | null;
  visibility?: string | null;
};

export type RequestActor = {
  userId: string;
  householdId: string | null;
};

/**
 * Readable outside exact household scope when shared catalog or public.
 */
export function recipeIsReadable(
  recipe: { householdId: string | null; visibility?: string | null },
  activeHouseholdId: string | null
): boolean {
  if (recipe.householdId == null) return true;
  if (activeHouseholdId != null && recipe.householdId === activeHouseholdId) {
    return true;
  }
  return (recipe.visibility ?? "").toLowerCase() === "public";
}

/**
 * Show "Request recipe" when signed-in user cannot already use the recipe
 * freely (shared catalog / own household) and there is an owner (or household)
 * to ask.
 */
export function canRequestRecipe(
  recipe: RequestableRecipe,
  actor: RequestActor | null
): boolean {
  if (!actor?.userId) return false;
  // Shared catalog — already everyone's
  if (recipe.householdId == null) return false;
  // Already in requester's household scope
  if (
    actor.householdId != null &&
    recipe.householdId === actor.householdId
  ) {
    return false;
  }
  // Own recipe
  if (recipe.ownerUserId && recipe.ownerUserId === actor.userId) return false;
  // Need someone to route the request to (owner preferred; household ok)
  if (!recipe.ownerUserId && !recipe.householdId) return false;
  return true;
}

export const RECIPE_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
] as const;
export type RecipeRequestStatus = (typeof RECIPE_REQUEST_STATUSES)[number];
