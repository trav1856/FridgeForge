import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCourseDetail } from "@/lib/howto";

type Ctx = { params: Promise<{ courseSlug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { courseSlug } = await ctx.params;
  const user = await getCurrentUser();
  const course = await getCourseDetail(courseSlug, user?.id ?? null);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  return NextResponse.json({
    signedIn: Boolean(user),
    course,
  });
}
