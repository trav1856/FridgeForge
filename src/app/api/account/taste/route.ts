import { NextRequest, NextResponse } from "next/server";
import { requireProfileOwner } from "@/lib/profile-auth";
import { assertSameOrigin } from "@/lib/same-origin";
import { adminErrorResponse } from "@/lib/admin";
import { clearMyViews, myTaste } from "@/lib/demographics/taste";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireProfileOwner();
  if (!auth.ok) return auth.res;
  return NextResponse.json({ cuisines: await myTaste(auth.user.id) }, { headers: { "Cache-Control": "no-store" } });
}

/** Clear my recipe-view history (favorites are untouched). */
export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const auth = await requireProfileOwner();
    if (!auth.ok) return auth.res;
    return NextResponse.json({ cleared: await clearMyViews(auth.user.id) });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
