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


/** Pending inbound rows suitable for owner inbox UI. */
export type IncomingRequestRow = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  recipe: { id: string; title: string };
  fromUser: { id: string; email: string; name: string | null };
};

export type PendingRecipeGroup = {
  recipeId: string;
  title: string;
  requests: IncomingRequestRow[];
};

/** Count pending inbound requests (owner needs to act). */
export function countPendingIncoming(
  rows: { status: string }[]
): number {
  return rows.filter((r) => r.status === "pending").length;
}

/**
 * Group pending requests by recipe (oldest first within each group).
 * Used for "Approve all" + "Choose who gets this" on the account inbox.
 */
export function groupPendingByRecipe(
  rows: IncomingRequestRow[]
): PendingRecipeGroup[] {
  const map = new Map<string, PendingRecipeGroup>();
  const pending = rows
    .filter((r) => r.status === "pending")
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  for (const row of pending) {
    const existing = map.get(row.recipe.id);
    if (existing) {
      existing.requests.push(row);
    } else {
      map.set(row.recipe.id, {
        recipeId: row.recipe.id,
        title: row.recipe.title,
        requests: [row],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
}

/** Browser event so the Account nav badge refreshes after inbox actions. */
export const RECIPE_REQUESTS_CHANGED_EVENT = "ff:recipe-requests-changed";

export function notifyRecipeRequestsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECIPE_REQUESTS_CHANGED_EVENT));
}
