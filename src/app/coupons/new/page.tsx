import { CouponCreateForm } from "@/components/CouponCreateForm";
import { GuestSignInNotice } from "@/components/GuestSignInNotice";

export default function NewCouponPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-sage-900">
          Add a coupon
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Saves a coupon to your household&apos;s list. It is only visible to
          your household.
        </p>
      </div>
      <GuestSignInNotice
        title="Sign in to add coupons"
        body="Guests can look at sample coupons; adding your own needs an account."
      />
      <CouponCreateForm />
    </div>
  );
}
