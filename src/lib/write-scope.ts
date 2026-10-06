import { NextResponse } from "next/server";
import { getActiveHouseholdId, getCurrentUser, type AuthUser } from "@/lib/auth";

/**
 * Write guard for household-owned data (pantry, staples, coupons, cooking).
 *
 * Guests and signed-in users without a household may still *read* what they
 * can read today, but every write needs a signed-in user with a household.
 * Guests never write to the shared (householdId = null) rows.
 */

export const SIGN_IN_REQUIRED_CODE = "SIGN_IN_REQUIRED";
export const HOUSEHOLD_REQUIRED_CODE = "HOUSEHOLD_REQUIRED";

export const WRITE_MESSAGES = {
  pantry: "Sign in to save your pantry.",
  coupons: "Sign in to save coupons.",
  cook: "Sign in to track cooking in your pantry.",
} as const;

export type WriteArea = keyof typeof WRITE_MESSAGES;

const NO_HOUSEHOLD_MESSAGE =
  "Create or join a household on your Account page to save changes.";

export type WriteScope = { user: AuthUser; householdId: string };

export type WriteScopeResult =
  | { ok: true; scope: WriteScope }
  | { ok: false; response: NextResponse };

/** Pure decision helper (unit-tested). */
export function decideWriteScope(
  user: AuthUser | null,
  area: WriteArea = "pantry"
): WriteScopeResult {
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: WRITE_MESSAGES[area], code: SIGN_IN_REQUIRED_CODE },
        { status: 401 }
      ),
    };
  }
  const householdId = getActiveHouseholdId(user);
  if (!householdId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: NO_HOUSEHOLD_MESSAGE, code: HOUSEHOLD_REQUIRED_CODE },
        { status: 401 }
      ),
    };
  }
  return { ok: true, scope: { user, householdId } };
}

/** Resolve the caller and require a signed-in user with a household. */
export async function requireWriteScope(
  area: WriteArea = "pantry"
): Promise<WriteScopeResult> {
  const user = await getCurrentUser();
  return decideWriteScope(user, area);
}

export function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
