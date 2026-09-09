/**
 * Recipe visibility: global | household | shared
 * Legacy DB values: public → global, private → household
 */

export const RECIPE_VISIBILITIES = ["global", "household", "shared"] as const;
export type RecipeVisibility = (typeof RECIPE_VISIBILITIES)[number];

export function normalizeVisibility(
  value: string | null | undefined
): RecipeVisibility {
  const v = (value ?? "household").trim().toLowerCase();
  if (v === "public" || v === "global") return "global";
  if (v === "private" || v === "household") return "household";
  if (v === "shared") return "shared";
  return "household";
}

export function visibilityLabel(value: string | null | undefined): string {
  switch (normalizeVisibility(value)) {
    case "global":
      return "Global";
    case "shared":
      return "Shared";
    default:
      return "Household";
  }
}

/** Cycle for admin UI. */
export function nextVisibility(value: string | null | undefined): RecipeVisibility {
  const v = normalizeVisibility(value);
  if (v === "global") return "household";
  if (v === "household") return "shared";
  return "global";
}

export type RecipeAccessActor = {
  userId?: string | null;
  userEmail?: string | null;
  householdId: string | null;
};

/**
 * Prisma where for recipe lists: global catalog + global recipes + own household
 * + owned + shared-with-me (user or household).
 */
export function recipeListAccessWhere(actor: RecipeAccessActor) {
  const globalClause = {
    visibility: { in: ["global", "public"] },
  };
  const catalog = { householdId: null as string | null };

  if (!actor.userId) {
    return { OR: [catalog, globalClause] };
  }

  const shareOr: Record<string, unknown>[] = [{ toUserId: actor.userId }];
  if (actor.userEmail) {
    shareOr.push({ toUserEmail: actor.userEmail.toLowerCase() });
  }
  if (actor.householdId) {
    shareOr.push({ toHouseholdId: actor.householdId });
  }

  const ors: Record<string, unknown>[] = [
    catalog,
    globalClause,
    { ownerUserId: actor.userId },
    {
      visibility: "shared",
      shares: { some: { OR: shareOr } },
    },
  ];
  if (actor.householdId) {
    // Household-visibility recipes in my household (and any row stored on my household)
    ors.push({ householdId: actor.householdId });
  }
  return { OR: ors };
}

export type ReadableRecipe = {
  householdId: string | null;
  visibility?: string | null;
  ownerUserId?: string | null;
  shares?: {
    toUserId?: string | null;
    toUserEmail?: string | null;
    toHouseholdId?: string | null;
  }[];
};

/** Detail/read access check (extends legacy recipeIsReadable). */
export function canViewRecipe(
  recipe: ReadableRecipe,
  actor: RecipeAccessActor
): boolean {
  const vis = normalizeVisibility(recipe.visibility);

  // Global catalog (null household) or explicit global
  if (recipe.householdId == null) return true;
  if (vis === "global") return true;

  // Owner always
  if (actor.userId && recipe.ownerUserId && recipe.ownerUserId === actor.userId) {
    return true;
  }

  // Same household
  if (
    actor.householdId != null &&
    recipe.householdId === actor.householdId
  ) {
    return true;
  }

  if (vis === "household") return false;

  // Shared: must be on the recipient list
  if (vis === "shared") {
    const shares = recipe.shares || [];
    if (!actor.userId && !actor.householdId) return false;
    return shares.some((s) => {
      if (actor.userId && s.toUserId === actor.userId) return true;
      if (
        actor.userEmail &&
        s.toUserEmail &&
        s.toUserEmail.toLowerCase() === actor.userEmail.toLowerCase()
      ) {
        return true;
      }
      if (
        actor.householdId &&
        s.toHouseholdId &&
        s.toHouseholdId === actor.householdId
      ) {
        return true;
      }
      return false;
    });
  }

  // Legacy public already handled as global
  return false;
}
