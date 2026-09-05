import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { serializeCoupon } from "@/lib/coupons";

const createSchema = z.object({
  brand: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  discountText: z.string().min(1).max(80),
  terms: z.string().max(2000).optional().nullable(),
  codeValue: z.string().min(1).max(120),
  codeType: z.enum(["qr", "barcode"]).default("qr"),
  expiresAt: z.string().datetime().optional().nullable(),
  clipped: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  const filter = req.nextUrl.searchParams.get("filter") || "all";
  const items = await prisma.coupon.findMany({
    orderBy: [{ clipped: "desc" }, { expiresAt: "asc" }, { brand: "asc" }],
  });
  let out = items.map(serializeCoupon);
  const now = Date.now();
  if (filter === "active") {
    out = out.filter((c) => !c.used && (!c.expiresAt || new Date(c.expiresAt).getTime() >= now));
  } else if (filter === "expired") {
    out = out.filter((c) => !c.used && c.expiresAt && new Date(c.expiresAt).getTime() < now);
  } else if (filter === "clipped") {
    out = out.filter((c) => c.clipped);
  } else if (filter === "used") {
    out = out.filter((c) => c.used);
  }
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const coupon = await prisma.coupon.create({
      data: {
        brand: data.brand,
        title: data.title,
        discountText: data.discountText,
        terms: data.terms ?? null,
        codeValue: data.codeValue,
        codeType: data.codeType,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        clipped: data.clipped ?? false,
      },
    });
    return NextResponse.json(serializeCoupon(coupon), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}
