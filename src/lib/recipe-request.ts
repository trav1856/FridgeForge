import { canViewRecipe } from "./recipe-visibility";
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
 * Readable when global catalog / global visibility / same household / shared recipient.
 * `shares` optional — pass when checking shared visibility for a signed-in user.
 */
export function recipeIsReadable(
  recipe: {
    householdId: string | null;
    visibility?: string | null;
    ownerUserId?: string | null;
    shares?: {
      toUserId?: string | null;
      toUserEmail?: string | null;
      toHouseholdId?: string | null;
    }[];
  },
  activeHouseholdId: string | null,
  actor?: { userId?: string | null; userEmail?: string | null } | null
): boolean {
  return canViewRecipe(recipe, {
    householdId: activeHouseholdId,
    userId: actor?.userId ?? null,
    userEmail: actor?.userEmail ?? null,
  });
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
