import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listUserBadges } from "@/lib/howto";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      signedIn: false,
      badges: [],
      message: "Sign in to earn and view How-to badges.",
    });
  }
  const badges = await listUserBadges(user.id);
  return NextResponse.json({ signedIn: true, badges });
}
