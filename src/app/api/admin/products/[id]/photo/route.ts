import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { writeAudit } from "@/lib/admin-users";
import { ImageReencodeError, reencodePhoto } from "@/lib/image-reencode";
import { saveProductImage } from "@/lib/product-images";
import { detachSharedPhoto } from "@/lib/shared-products";

type Ctx = { params: Promise<{ id: string }> };

/** Replace a shared product's photo (re-encoded, metadata stripped). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const before = await prisma.sharedProduct.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
    const webp = await reencodePhoto(Buffer.from(await file.arrayBuffer()));
    const imageUrl = await saveProductImage("shared", webp);
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.sharedProduct.update({ where: { id }, data: { imageUrl } });
      await writeAudit(tx, {
        actorId: admin.id,
        targetUserId: null,
        action: "product.photo.replace",
        details: { productId: id, barcode: p.barcode },
      });
      return p;
    });
    if (before.imageUrl) {
      // Items/overrides that showed the old shared photo follow the new one.
      await prisma.pantryItem.updateMany({ where: { imageUrl: before.imageUrl }, data: { imageUrl } });
      await prisma.householdProductOverride.updateMany({ where: { imageUrl: before.imageUrl }, data: { imageUrl } });
      await detachSharedPhoto(before.imageUrl);
    }
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof ImageReencodeError) return NextResponse.json({ error: err.message }, { status: err.status });
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/products photo POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const before = await prisma.sharedProduct.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.sharedProduct.update({ where: { id }, data: { imageUrl: null } });
      await writeAudit(tx, {
        actorId: admin.id,
        targetUserId: null,
        action: "product.photo.remove",
        details: { productId: id, barcode: p.barcode },
      });
      return p;
    });
    await detachSharedPhoto(before.imageUrl);
    return NextResponse.json({ product });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/products photo DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
