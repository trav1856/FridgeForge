import { NextResponse } from "next/server";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { canAccessLiveCoupons } from "@/lib/edition";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: publicUser(user),
    features: {
      liveCoupons: canAccessLiveCoupons(user),
    },
  });
}
