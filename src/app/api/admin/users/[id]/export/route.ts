import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { buildUserExport, recordExport } from "@/lib/admin-users";
import { adminActionErrorResponse } from "@/lib/admin-api-errors";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const data = await buildUserExport(id);
    await recordExport(admin.id, id);
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="fridgeforge-user-${id}-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return adminActionErrorResponse(err, "admin/users export");
  }
}
