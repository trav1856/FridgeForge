import { NextRequest, NextResponse } from "next/server";
import { getActiveHouseholdId, getCurrentUser } from "@/lib/auth";
import { getProfilePageData } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ handle: string }> };

/** Public profile JSON (allow-listed fields only). Private profiles → minimal stub. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { handle } = await ctx.params;
  const viewerUser = await getCurrentUser();
  const data = await getProfilePageData(handle, {
    userId: viewerUser?.id ?? null,
    userEmail: viewerUser?.email ?? null,
    householdId: getActiveHouseholdId(viewerUser),
  });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
