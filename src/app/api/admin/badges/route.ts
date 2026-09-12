import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
  BadgeAdminError,
  createBadge,
  listAdminBadges,
  listAdminCourses,
} from "@/lib/badges-admin";

export async function GET() {
  try {
    await requireAdmin();
    const [badges, courses] = await Promise.all([
      listAdminBadges(),
      listAdminCourses(),
    ]);
    return NextResponse.json({ badges, courses });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  emoji: z.string().max(16).optional().nullable(),
  slug: z.string().max(48).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const data = createSchema.parse(await req.json());
    const badge = await createBadge(data);
    return NextResponse.json({ badge }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof BadgeAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges POST", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
