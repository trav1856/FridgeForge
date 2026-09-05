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

/** Prisma where clause for guest (null) vs household-scoped rows. */
export function householdWhere(householdId: string | null) {
  return { householdId };
}

/**
 * Whether a row belongs to the active scope.
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
