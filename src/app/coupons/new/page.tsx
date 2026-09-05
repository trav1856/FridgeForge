import { CouponCreateForm } from "@/components/CouponCreateForm";

export default function NewCouponPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-sage-900">
          Create demo coupon
        </h1>
        <p className="mt-1 text-sm text-sage-600">
          Manufacturer admin stub — local only, no auth.
        </p>
      </div>
      <CouponCreateForm />
    </div>
  );
}
