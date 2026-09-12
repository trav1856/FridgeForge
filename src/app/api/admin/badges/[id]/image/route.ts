import { NextRequest, NextResponse } from "next/server";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
  BadgeAdminError,
  clearBadgeImage,
  setBadgeImageFromUpload,
} from "@/lib/badges-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const badge = await setBadgeImageFromUpload(id, {
      mime: file.type || null,
      size: bytes.length,
      bytes,
    });
    return NextResponse.json({ badge });
  } catch (err) {
    if (err instanceof BadgeAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges/[id]/image POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const badge = await clearBadgeImage(id);
    return NextResponse.json({ badge });
  } catch (err) {
    if (err instanceof BadgeAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges/[id]/image DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
