import { prisma } from "@/lib/db";
import {
  buildUserOrderBy,
  buildUserWhere,
  pageWindow,
  USER_LIST_PAGE_SIZE,
  type UserListParams,
} from "@/lib/admin-user-query";

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  disabled: boolean;
  createdAt: Date;
  lastActiveAt: Date | null;
  recipes: number;
  cooks: number;
  /** Pantry items in the primary (first-joined) household; null = no household. */
  pantry: number | null;
  primaryHousehold: string | null;
};

export async function listAdminUsers(p: UserListParams, now: Date = new Date()) {
  const where = buildUserWhere(p, now);
  const total = await prisma.user.count({ where });
  const win = pageWindow(total, p.page, USER_LIST_PAGE_SIZE);
  const users = await prisma.user.findMany({
    where,
    orderBy: buildUserOrderBy(p),
    skip: win.skip,
    take: win.take,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      disabled: true,
      createdAt: true,
      lastActiveAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { householdId: true, household: { select: { name: true } } },
      },
      _count: {
        select: {
          ownedRecipes: true,
          cookSessions: { where: { undoneAt: null } },
        },
      },
    },
  });
  const hhIds = [...new Set(users.map((u) => u.memberships[0]?.householdId).filter((x): x is string => !!x))];
  const pantryCounts = hhIds.length
    ? await prisma.pantryItem.groupBy({
        by: ["householdId"],
        where: { householdId: { in: hhIds } },
        _count: { _all: true },
      })
    : [];
  const pantryBy = new Map(pantryCounts.map((r) => [r.householdId, r._count._all]));
  const rows: AdminUserListRow[] = users.map((u) => {
    const hh = u.memberships[0];
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      plan: u.plan,
      disabled: u.disabled,
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
      recipes: u._count.ownedRecipes,
      cooks: u._count.cookSessions,
      pantry: hh ? pantryBy.get(hh.householdId) ?? 0 : null,
      primaryHousehold: hh?.household.name ?? null,
    };
  });
  return { rows, total, ...win };
}
