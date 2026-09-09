import type { PrismaClient } from "@prisma/client";

/**
 * Parse recipe.tags JSON and return true if it includes staple or classic.
 */
export function isStapleOrClassicTagJson(tagsJson: string | null | undefined): boolean {
  try {
    const tags = JSON.parse(tagsJson || "[]") as unknown;
    if (!Array.isArray(tags)) return false;
    return tags.some(
      (t) =>
        typeof t === "string" &&
        (t.toLowerCase() === "staple" || t.toLowerCase() === "classic")
    );
  } catch {
    return false;
  }
}

/**
 * Historically copied shared staple/classic recipes into each new household.
 * That duplicated titles under recipeScopeWhere (shared OR household).
 *
 * No longer clones: the shared catalog (householdId null) is visible to every
 * household via recipeScopeWhere. Kept as a documented no-op so call sites
 * (households POST, seed) stay stable and return 0.
 */
export async function cloneStapleRecipesToHousehold(
  _prisma: PrismaClient,
  _householdId: string
): Promise<number> {
  return 0;
}
