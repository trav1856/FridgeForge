import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import {
  BadgeAdminError,
  listAdminCourses,
  setCourseBadge,
} from "@/lib/badges-admin";

export async function GET() {
  try {
    await requireAdmin();
    const courses = await listAdminCourses();
    return NextResponse.json({ courses });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges/courses GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const patchSchema = z.object({
  courseId: z.string().min(1),
  badgeId: z.string().min(1).nullable(),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const data = patchSchema.parse(await req.json());
    const course = await setCourseBadge(data.courseId, data.badgeId);
    return NextResponse.json({ course });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof BadgeAdminError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/badges/courses PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
