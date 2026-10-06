import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminErrorResponse, requireAdmin } from "@/lib/admin";
import { assertSameOrigin } from "@/lib/same-origin";
import { parseUserListParams } from "@/lib/admin-user-query";
import { listAdminUsers } from "@/lib/admin-user-list";
import {
  AdminActionError,
  setUserPlan,
  setUserRole,
  suspendUser,
  unsuspendUser,
  SUSPEND_REASON_MAX,
} from "@/lib/admin-users";

/** Same filters as /admin/users (q, role, plan, status, active, signedUp, from, to, sort, dir, page). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const params = parseUserListParams(Object.fromEntries(req.nextUrl.searchParams));
    const list = await listAdminUsers(params);
    return NextResponse.json({
      total: list.total,
      page: list.page,
      pageCount: list.pageCount,
      users: list.rows.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/users GET", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "admin"]).optional(),
  disabled: z.boolean().optional(),
  /** Required when disabled=true (suspend). */
  reason: z.string().max(SUSPEND_REASON_MAX).optional(),
  plan: z.enum(["community", "pro"]).optional(),
});

/** Role / plan / suspend. Guards + audit live in lib/admin-users. */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    assertSameOrigin(req);
    const data = patchSchema.parse(await req.json());
    if (data.disabled === true && !data.reason?.trim()) {
      return NextResponse.json({ error: "A suspend reason is required" }, { status: 400 });
    }
    let user: { id: string; email: string; role: string; plan: string; disabled: boolean } | null = null;
    if (data.plan) user = await setUserPlan(admin.id, data.id, data.plan);
    if (data.role) user = await setUserRole(admin.id, data.id, data.role);
    if (data.disabled === true) user = await suspendUser(admin.id, data.id, data.reason!);
    if (data.disabled === false) user = await unsuspendUser(admin.id, data.id);
    if (!user) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    return NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role, plan: user.plan, disabled: user.disabled },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof AdminActionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const res = adminErrorResponse(err);
    if (res) return res;
    console.error("admin/users PATCH", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
