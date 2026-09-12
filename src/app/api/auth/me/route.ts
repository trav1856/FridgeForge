import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { canAccessLiveCoupons } from "@/lib/edition";
import { ensureUserProfileSlug } from "@/lib/public-profile";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  if (!user.profileSlug) {
    const slug = await ensureUserProfileSlug(user);
    user.profileSlug = slug;
  }
  return NextResponse.json({
    user: publicUser(user),
    features: {
      liveCoupons: canAccessLiveCoupons(user),
    },
  });
}
