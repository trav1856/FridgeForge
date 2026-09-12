import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
  BadgeAdminError,
  deleteBadge,
  updateBadge,
} from "@/lib/badges-admin";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  emoji: z.string().max(16).optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const data = patchSchema.parse(await req.json());
    const badge = await updateBadge(id, data);
    return NextResponse.json({ badge });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof BadgeAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges/[id] PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await deleteBadge(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BadgeAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges/[id] DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
