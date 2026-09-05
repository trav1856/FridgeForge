import type { Coupon } from "@prisma/client";

export type CouponDTO = {
  id: string;
  brand: string;
  title: string;
  discountText: string;
  terms: string | null;
  codeValue: string;
  codeType: "qr" | "barcode";
  expiresAt: string | null;
  clipped: boolean;
  used: boolean;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expired: boolean;
  status: "active" | "expired" | "used";
};

export function serializeCoupon(c: Coupon): CouponDTO {
  const expiresAt = c.expiresAt?.toISOString() ?? null;
  const expired = c.expiresAt ? c.expiresAt.getTime() < Date.now() : false;
  let status: CouponDTO["status"] = "active";
  if (c.used) status = "used";
  else if (expired) status = "expired";
  return {
    id: c.id,
    brand: c.brand,
    title: c.title,
    discountText: c.discountText,
    terms: c.terms,
    codeValue: c.codeValue,
    codeType: c.codeType === "barcode" ? "barcode" : "qr",
    expiresAt,
    clipped: c.clipped,
    used: c.used,
    usedAt: c.usedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    expired,
    status,
  };
}
