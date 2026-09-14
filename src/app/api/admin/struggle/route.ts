import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
  StruggleAdminError,
  createStruggleResource,
  listAdminStruggleResources,
  normalizeStruggleKind,
  parseStruggleLinks,
} from "@/lib/struggle-resources";

export async function GET() {
  try {
    await requireAdmin();
    const resources = await listAdminStruggleResources();
    return NextResponse.json({ resources });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/struggle GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const createSchema = z.object({
  kind: z.enum(["tip", "kids_meal"]),
  title: z.string().min(1).max(120),
  slug: z.string().max(64).optional().nullable(),
  summary: z.string().min(1).max(600),
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

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const data = createSchema.parse(await req.json());
    const kind = normalizeStruggleKind(data.kind);
    if (!kind) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const resource = await createStruggleResource({
      kind,
      title: data.title,
      slug: data.slug,
      summary: data.summary,
      body: data.body,
      links: data.links ? parseStruggleLinks(data.links) : [],
      whenLabel: data.whenLabel,
      sortOrder: data.sortOrder,
      published: data.published,
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof StruggleAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/struggle POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
