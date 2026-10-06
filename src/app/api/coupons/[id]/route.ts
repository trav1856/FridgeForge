import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { serializeCoupon } from "@/lib/coupons";
import { resolveHouseholdId } from "@/lib/auth";
import { rowMatchesScope } from "@/lib/household";
import { findSampleCoupon, isSampleCouponId } from "@/lib/sample-coupons";
import { notFoundResponse, requireWriteScope } from "@/lib/write-scope";

const patchSchema = z.object({
  clipped: z.boolean().optional(),
  used: z.boolean().optional(),
  brand: z.string().min(1).max(80).optional(),
  title: z.string().min(1).max(160).optional(),
  discountText: z.string().min(1).max(80).optional(),
  terms: z.string().max(2000).optional().nullable(),
  codeValue: z.string().min(1).max(120).optional(),
  codeType: z.enum(["qr", "barcode"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const householdId = await resolveHouseholdId();
  // Guests: static samples only. Households: their own coupons only.
  if (isSampleCouponId(id)) {
    const sample = householdId ? null : findSampleCoupon(id);
    return sample ? NextResponse.json(sample) : notFoundResponse();
  }
  if (!householdId) return notFoundResponse();
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon || !rowMatchesScope(coupon.householdId, householdId)) {
    return notFoundResponse();
  }
  return NextResponse.json(serializeCoupon(coupon));
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const guard = await requireWriteScope("coupons");
    if (!guard.ok) return guard.response;
    const { id } = await ctx.params;
    const existing = await prisma.coupon.findUnique({
      where: { id },
      select: { householdId: true },
    });
    // Writes are exact-household only (sample coupons are never DB rows).
    if (!existing || !rowMatchesScope(existing.householdId, guard.scope.householdId)) {
      return notFoundResponse();
    }
    const body = await req.json();
    const data = patchSchema.parse(body);
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(data.clipped !== undefined && { clipped: data.clipped }),
        ...(data.used !== undefined && {
          used: data.used,
          usedAt: data.used ? new Date() : null,
        }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.discountText !== undefined && { discountText: data.discountText }),
        ...(data.terms !== undefined && { terms: data.terms }),
        ...(data.codeValue !== undefined && { codeValue: data.codeValue }),
        ...(data.codeType !== undefined && { codeType: data.codeType }),
        ...(data.expiresAt !== undefined && {
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        }),
      },
    });
    return NextResponse.json(serializeCoupon(coupon));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const guard = await requireWriteScope("coupons");
    if (!guard.ok) return guard.response;
    const { id } = await ctx.params;
    const existing = await prisma.coupon.findUnique({
      where: { id },
      select: { householdId: true },
    });
    if (!existing || !rowMatchesScope(existing.householdId, guard.scope.householdId)) {
      return notFoundResponse();
    }
    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
