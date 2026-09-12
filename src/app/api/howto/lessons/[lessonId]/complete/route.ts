import { NextResponse } from "next/server";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { markLessonComplete } from "@/lib/howto";

type Ctx = { params: Promise<{ lessonId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: "Sign in to track progress and earn badges.",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }
    const { lessonId } = await ctx.params;
    const result = await markLessonComplete(user.id, lessonId);
    if (!result) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Failed to mark lesson complete" },
      { status: 500 }
    );
  }
}
