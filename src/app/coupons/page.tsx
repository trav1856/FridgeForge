import Link from "next/link";
import { CouponsView } from "@/components/CouponsView";
import { StruggleBanner } from "@/components/StruggleBanner";
import { ProCouponsBanner } from "@/components/ProCouponsBanner";

export default function CouponsPage() {
  return (
    <div>
      <StruggleBanner />
      <ProCouponsBanner />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-900">
            Coupons
          </h1>
          <p className="mt-1 text-sm text-sage-600">
            Clip manufacturer-style offers and open a bright redeem view at the
            register. Demo coupons stay available for everyone.
          </p>
        </div>
        <Link href="/coupons/new" className="btn-secondary text-sm">
          Create demo
        </Link>
      </div>
      <CouponsView />
    </div>
  );
}
