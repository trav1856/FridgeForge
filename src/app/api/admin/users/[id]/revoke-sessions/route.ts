import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { revokeUserSessions } from "@/lib/admin-users";
import { adminActionErrorResponse } from "@/lib/admin-api-errors";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const revoked = await revokeUserSessions(admin.id, id);
    return NextResponse.json({ ok: true, revoked });
  } catch (err) {
    return adminActionErrorResponse(err, "admin/users revoke-sessions");
  }
}
