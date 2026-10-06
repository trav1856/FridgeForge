import type { CouponDTO } from "./coupons";
import type { CouponMatchInput } from "./deals";

/**
 * Sample coupons shown to guests. Static fixture: never stored in the DB,
 * no brands, no prices, no scannable codes. Everything here is marked
 * `sample: true` and rendered with a "SAMPLE — NOT VALID" watermark.
 */
export const SAMPLE_COUPON_PREFIX = "sample-";
export const SAMPLE_WATERMARK = "SAMPLE — NOT VALID";

type Fixture = { slug: string; title: string; discountText: string };

const FIXTURE: Fixture[] = [
  { slug: "rice", title: "Any rice, 2 lb or more", discountText: "Save on rice" },
  { slug: "beans", title: "Any canned or dry beans", discountText: "Save on beans" },
  { slug: "tuna", title: "Any canned tuna", discountText: "Save on canned tuna" },
  { slug: "eggs", title: "Any dozen eggs", discountText: "Save on eggs" },
  { slug: "pasta", title: "Any dry pasta, 12 oz or more", discountText: "Save on pasta" },
  { slug: "sauce", title: "Any pasta or tomato sauce", discountText: "Save on sauce" },
  { slug: "butter", title: "Any butter sticks", discountText: "Save on butter" },
  { slug: "soy", title: "Any soy sauce", discountText: "Save on soy sauce" },
];

const EPOCH = "2026-01-01T00:00:00.000Z";

export type SampleCouponDTO = CouponDTO & { sample: true };

export const SAMPLE_COUPONS: SampleCouponDTO[] = FIXTURE.map((f) => ({
  id: `${SAMPLE_COUPON_PREFIX}${f.slug}`,
  brand: "Sample coupon",
  title: f.title,
  discountText: f.discountText,
  terms: "Sample for demonstration only. Not a real coupon and cannot be redeemed anywhere.",
  codeValue: "SAMPLE",
  codeType: "qr",
  expiresAt: null,
  clipped: false,
  used: false,
  usedAt: null,
  createdAt: EPOCH,
  updatedAt: EPOCH,
  expired: false,
  status: "active",
  sample: true,
}));

export function isSampleCouponId(id: string): boolean {
  return id.startsWith(SAMPLE_COUPON_PREFIX);
}

export function findSampleCoupon(id: string): SampleCouponDTO | null {
  return SAMPLE_COUPONS.find((c) => c.id === id) ?? null;
}

/** For deal matching (findDealsForMissingIngredients). */
export function sampleCouponsForMatching(): CouponMatchInput[] {
  return SAMPLE_COUPONS.map((c) => ({
    id: c.id,
    brand: c.brand,
    title: c.title,
    discountText: c.discountText,
    codeValue: c.codeValue,
    used: false,
    expiresAt: null,
    sample: true,
  }));
}
