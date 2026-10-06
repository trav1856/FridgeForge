import Link from "next/link";
import { CouponsView } from "@/components/CouponsView";
import { StruggleBanner } from "@/components/StruggleBanner";
import { ProCouponsBanner } from "@/components/ProCouponsBanner";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const user = await getCurrentUser();
  const householdId = user ? await resolveHouseholdId() : null;
  return (
    <div>
      <StruggleBanner />
      <ProCouponsBanner />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-900">
            Coupons
          </h1>
          {user ? (
            <p className="mt-1 text-sm text-sage-600">
              Your household&apos;s coupons. Clip offers and open a bright
              redeem view at the register.
            </p>
          ) : (
            <p className="mt-1 text-sm text-sage-600" data-testid="coupons-guest-copy">
              These are <strong>sample coupons</strong> that show how deals
              work. They are not valid in any store.{" "}
              <Link href="/account" className="font-semibold underline">
                Sign in
              </Link>{" "}
              to keep your own household&apos;s coupons.
            </p>
          )}
        </div>
        {householdId && (
          <Link href="/coupons/new" className="btn-secondary text-sm">
            Add a coupon
          </Link>
        )}
      </div>
      <CouponsView />
    </div>
  );
}
