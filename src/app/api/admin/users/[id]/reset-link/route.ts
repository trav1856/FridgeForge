import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin, requestBaseUrl } from "@/lib/same-origin";
import { createUserResetLink } from "@/lib/admin-users";
import { adminActionErrorResponse } from "@/lib/admin-api-errors";

/** Returns the one-time link exactly once; only its hash is stored. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const { url, expiresAt } = await createUserResetLink(admin.id, id, requestBaseUrl(req));
    return NextResponse.json(
      { url, expiresAt: expiresAt.toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return adminActionErrorResponse(err, "admin/users reset-link");
  }
}
