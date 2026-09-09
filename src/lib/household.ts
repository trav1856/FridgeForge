import { randomBytes } from "crypto";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short invite codes: 8 chars, unambiguous alphabet (no 0/O/1/I). */
export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += INVITE_ALPHABET[bytes[i]! % INVITE_ALPHABET.length];
  }
  return out;
}

/**
 * Exact household scope (pantry, staples, shopping).
 * Guests → null; members → their household only. Never merges across households.
 */
export function householdWhere(householdId: string | null) {
  return { householdId };
}

/**
 * Shared catalog + household scope for recipes (and coupon-style catalogs).
 * Shared / system recipes are stored with householdId null and are available to
 * everyone (guests and signed-in). Signed-in households also see their own rows.
 * Pantry stays on householdWhere — do not use this for pantry.
 */
export function recipeScopeWhere(householdId: string | null) {
  if (householdId === null) {
    return { householdId: null as string | null };
  }
  return {
    OR: [{ householdId: null }, { householdId }],
  };
}

/** Alias used by coupons / deals — same shared-or-household pattern. */
export const sharedOrHouseholdWhere = recipeScopeWhere;

/**
 * Whether a pantry/exact-scoped row belongs to the active scope.
 * Guests only see/write null householdId; members only their household.
 */
export function rowMatchesScope(
  rowHouseholdId: string | null | undefined,
  activeHouseholdId: string | null
): boolean {
  if (activeHouseholdId === null) {
    return rowHouseholdId == null;
  }
  return rowHouseholdId === activeHouseholdId;
}

/**
 * Whether a recipe (shared catalog or household) is readable in the active scope.
 * Shared = householdId null → visible to guests and all households.
 * Household-owned → only that household.
 */
export function recipeRowMatchesScope(
  rowHouseholdId: string | null | undefined,
  activeHouseholdId: string | null
): boolean {
  if (rowHouseholdId == null) return true;
  if (activeHouseholdId === null) return false;
  return rowHouseholdId === activeHouseholdId;
}
