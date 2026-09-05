import type { AuthUser } from "@/lib/auth";

/** Demo coupons stay visible for everyone. Live manufacturer deals are Pro. */
export function canAccessLiveCoupons(
  user: Pick<AuthUser, "plan"> | null | undefined
): boolean {
  return user?.plan === "pro";
}
