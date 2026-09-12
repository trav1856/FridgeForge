import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCoursesForUser, listUserBadges } from "@/lib/howto";

export async function GET() {
  const user = await getCurrentUser();
  const courses = await listCoursesForUser(user?.id ?? null);
  const badges = user ? await listUserBadges(user.id) : [];
  return NextResponse.json({
    signedIn: Boolean(user),
    courses,
    badges,
  });
}
