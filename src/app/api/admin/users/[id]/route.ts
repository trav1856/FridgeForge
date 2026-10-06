import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { deleteUser } from "@/lib/admin-users";
import { adminActionErrorResponse } from "@/lib/admin-api-errors";

const deleteSchema = z.object({ confirmEmail: z.string().min(3).max(200) });

/** Hard delete. Requires typed email + an export by this admin in the last 30 min. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const { confirmEmail } = deleteSchema.parse(await req.json());
    const summary = await deleteUser(admin.id, id, confirmEmail);
    return NextResponse.json({
      ok: true,
      householdsDeleted: summary.householdsDeleted.length,
      ownershipTransferred: summary.ownershipTransferred.length,
      recipesUnlinked: summary.recipesUnlinked,
      cookSessionsUnlinked: summary.cookSessionsUnlinked,
    });
  } catch (err) {
    return adminActionErrorResponse(err, "admin/users/[id] DELETE");
  }
}
