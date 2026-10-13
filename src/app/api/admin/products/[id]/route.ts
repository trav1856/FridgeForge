import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/admin-users";
import { detachSharedPhoto } from "@/lib/shared-products";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  size: z.string().trim().max(60).optional().nullable(),
  unit: z.string().trim().max(40).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = patchSchema.parse(await req.json());
    const before = await prisma.sharedProduct.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.sharedProduct.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.size !== undefined && { size: data.size || null }),
          ...(data.unit !== undefined && { unit: data.unit || null }),
          ...(data.category !== undefined && { category: data.category || null }),
        },
      });
      await writeAudit(tx, {
        actorId: admin.id,
        targetUserId: null,
        action: "product.update",
        details: {
          productId: id,
          barcode: p.barcode,
          before: { name: before.name, size: before.size, unit: before.unit, category: before.category },
          after: { name: p.name, size: p.size, unit: p.unit, category: p.category },
        },
      });
      return p;
    });
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/products PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const before = await prisma.sharedProduct.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.sharedProduct.delete({ where: { id } });
      await writeAudit(tx, {
        actorId: admin.id,
        targetUserId: null,
        action: "product.delete",
        details: { productId: id, barcode: before.barcode, name: before.name, hadPhoto: Boolean(before.imageUrl) },
      });
    });
    await detachSharedPhoto(before.imageUrl);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/products DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
