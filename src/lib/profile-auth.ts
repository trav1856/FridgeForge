import { NextResponse } from "next/server";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

/**
 * Every profile write acts on the signed-in user only: routes never take a
 * user id, so one account can't target another's profile.
 */
export async function requireProfileOwner(): Promise<
  { ok: true; user: AuthUser } | { ok: false; res: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Sign in to edit your profile.", code: "SIGN_IN_REQUIRED" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user };
}

export function ageConfirmRequired() {
  return NextResponse.json(
    {
      error: "Confirm your date of birth on the Edit profile page first.",
      code: "AGE_CONFIRM_REQUIRED",
    },
    { status: 403 }
  );
}
