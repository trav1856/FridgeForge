import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
  StruggleAdminError,
  deleteStruggleResource,
  normalizeStruggleKind,
  parseStruggleLinks,
  updateStruggleResource,
} from "@/lib/struggle-resources";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  kind: z.enum(["tip", "kids_meal"]).optional(),
  title: z.string().min(1).max(120).optional(),
  slug: z.string().max(64).optional().nullable(),
  summary: z.string().min(1).max(600).optional(),
  body: z.string().max(20000).optional().nullable(),
  links: z
    .array(z.object({ label: z.string(), url: z.string() }))
    .max(12)
    .optional()
    .nullable(),
  whenLabel: z.string().max(40).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional().nullable(),
  published: z.boolean().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const data = patchSchema.parse(await req.json());
    const resource = await updateStruggleResource(id, {
      kind: data.kind ? normalizeStruggleKind(data.kind) ?? undefined : undefined,
      title: data.title,
      slug: data.slug,
      summary: data.summary,
      body: data.body,
      links: data.links !== undefined ? parseStruggleLinks(data.links ?? []) : undefined,
      whenLabel: data.whenLabel,
      sortOrder: data.sortOrder,
      published: data.published,
    });
    return NextResponse.json({ resource });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof StruggleAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/struggle/[id] PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    await deleteStruggleResource(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StruggleAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/struggle/[id] DELETE", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
