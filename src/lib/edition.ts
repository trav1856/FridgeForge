import type { AuthUser } from "@/lib/auth";

/** Guests see static sample coupons; households see their own. Live manufacturer deals are Premium (plan=pro). */
export function canAccessLiveCoupons(
  user: Pick<AuthUser, "plan"> | null | undefined
): boolean {
  return user?.plan === "pro";
}
