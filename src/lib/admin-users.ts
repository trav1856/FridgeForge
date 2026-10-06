import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { issueResetToken, resetLinkUrl } from "@/lib/password-reset";
import { deleteOrphanedRecipeImages } from "@/lib/recipe-image-cleanup";
import { deleteManagedPantryUserImage } from "@/lib/pantry-user-images";

/**
 * Admin user-management actions. Every mutation runs in a transaction and
 * writes an AdminAuditLog row. Callers must already have passed requireAdmin()
 * (src/lib/admin.ts) and the same-origin check.
 */

export class AdminActionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
  }
}

export const AUDIT_ACTIONS = [
  "user.role",
  "user.plan",
  "user.suspend",
  "user.unsuspend",
  "user.sessions.revoke",
  "user.reset_link",
  "user.export",
  "user.delete",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_LABELS: Record<AuditAction, string> = {
  "user.role": "changed role",
  "user.plan": "changed plan",
  "user.suspend": "suspended account",
  "user.unsuspend": "unsuspended account",
  "user.sessions.revoke": "signed out everywhere",
  "user.reset_link": "generated reset link",
  "user.export": "exported data",
  "user.delete": "deleted account",
};

/** Delete requires an export by the same admin within this window. */
export const EXPORT_BEFORE_DELETE_MS = 30 * 60 * 1000;
export const SUSPEND_REASON_MAX = 500;

type AuditDb = Pick<Prisma.TransactionClient, "adminAuditLog">;

export async function writeAudit(
  db: AuditDb,
  entry: {
    actorId: string;
    targetUserId: string | null;
    action: AuditAction;
    details?: Prisma.InputJsonObject;
  }
) {
  return db.adminAuditLog.create({
    data: {
      actorId: entry.actorId,
      targetUserId: entry.targetUserId,
      action: entry.action,
      details: entry.details ?? {},
    },
  });
}

export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

// ---------------------------------------------------------------------------
// Guards (pure)

export type GuardTarget = { id: string; role: string; disabled: boolean };

function isActiveAdmin(t: GuardTarget) {
  return t.role === "admin" && !t.disabled;
}

/** null = allowed, otherwise the error message. */
export function guardRoleChange(
  actorId: string,
  target: GuardTarget,
  newRole: "user" | "admin",
  activeAdminCount: number
): string | null {
  if (newRole === target.role) return null;
  if (newRole !== "admin" && actorId === target.id) {
    return "You can't remove your own admin role";
  }
  if (newRole !== "admin" && isActiveAdmin(target) && activeAdminCount <= 1) {
    return "Can't remove the last admin";
  }
  return null;
}

export function guardSuspend(
  actorId: string,
  target: GuardTarget,
  activeAdminCount: number
): string | null {
  if (actorId === target.id) return "You can't suspend yourself";
  if (isActiveAdmin(target) && activeAdminCount <= 1) return "Can't suspend the last admin";
  return null;
}

export function guardDelete(
  actorId: string,
  target: GuardTarget,
  activeAdminCount: number
): string | null {
  if (actorId === target.id) return "You can't delete yourself";
  if (target.role === "admin" && activeAdminCount <= (isActiveAdmin(target) ? 1 : 0)) {
    return "Can't delete the last admin";
  }
  return null;
}

type CountDb = Pick<Prisma.TransactionClient, "user">;

export function countActiveAdmins(db: CountDb) {
  return db.user.count({ where: { role: "admin", disabled: false } });
}

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

async function loadTarget(tx: Prisma.TransactionClient, id: string) {
  const u = await tx.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, plan: true, disabled: true },
  });
  if (!u) throw new AdminActionError("User not found", 404);
  return u;
}

// ---------------------------------------------------------------------------
// Actions

export async function setUserRole(actorId: string, targetId: string, role: "user" | "admin") {
  return prisma.$transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    const err = guardRoleChange(actorId, t, role, await countActiveAdmins(tx));
    if (err) throw new AdminActionError(err);
    if (t.role === role) return t;
    const u = await tx.user.update({ where: { id: targetId }, data: { role } });
    await writeAudit(tx, {
      actorId,
      targetUserId: targetId,
      action: "user.role",
      details: { from: t.role, to: role },
    });
    return u;
  }, SERIALIZABLE);
}

export async function setUserPlan(actorId: string, targetId: string, plan: "community" | "pro") {
  return prisma.$transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    if (t.plan === plan) return t;
    const u = await tx.user.update({ where: { id: targetId }, data: { plan } });
    await writeAudit(tx, {
      actorId,
      targetUserId: targetId,
      action: "user.plan",
      details: { from: t.plan, to: plan },
    });
    return u;
  });
}

/** Suspend = existing `disabled` gate (blocks sign-in) + end every session. */
export async function suspendUser(actorId: string, targetId: string, reason: string) {
  const clean = reason.trim().slice(0, SUSPEND_REASON_MAX);
  if (!clean) throw new AdminActionError("A reason is required");
  return prisma.$transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    const err = guardSuspend(actorId, t, await countActiveAdmins(tx));
    if (err) throw new AdminActionError(err);
    const now = new Date();
    const u = await tx.user.update({
      where: { id: targetId },
      data: { disabled: true, disabledReason: clean, disabledAt: now, disabledById: actorId },
    });
    const sessions = await tx.session.deleteMany({ where: { userId: targetId } });
    await writeAudit(tx, {
      actorId,
      targetUserId: targetId,
      action: "user.suspend",
      details: { reason: clean, sessionsRevoked: sessions.count, wasSuspended: t.disabled },
    });
    return u;
  }, SERIALIZABLE);
}

export async function unsuspendUser(actorId: string, targetId: string) {
  return prisma.$transaction(async (tx) => {
    const t = await loadTarget(tx, targetId);
    if (!t.disabled) return t;
    const u = await tx.user.update({
      where: { id: targetId },
      data: { disabled: false, disabledReason: null, disabledAt: null, disabledById: null },
    });
    await writeAudit(tx, { actorId, targetUserId: targetId, action: "user.unsuspend" });
    return u;
  });
}

export async function revokeUserSessions(actorId: string, targetId: string) {
  return prisma.$transaction(async (tx) => {
    await loadTarget(tx, targetId);
    const r = await tx.session.deleteMany({ where: { userId: targetId } });
    await writeAudit(tx, {
      actorId,
      targetUserId: targetId,
      action: "user.sessions.revoke",
      details: { sessionsRevoked: r.count },
    });
    return r.count;
  });
}

export async function createUserResetLink(actorId: string, targetId: string, baseUrl: string) {
  return prisma.$transaction(async (tx) => {
    await loadTarget(tx, targetId);
    const { raw, expiresAt } = await issueResetToken(tx, targetId, actorId);
    await writeAudit(tx, {
      actorId,
      targetUserId: targetId,
      action: "user.reset_link",
      details: { expiresAt: expiresAt.toISOString() },
    });
    return { url: resetLinkUrl(baseUrl, raw), expiresAt };
  });
}

// ---------------------------------------------------------------------------
// Export

/** Everything we hold about one user, minus secrets (password hash, session tokens, reset tokens). */
export async function buildUserExport(targetId: string) {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        include: {
          household: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              members: {
                orderBy: { createdAt: "asc" },
                select: { role: true, createdAt: true, user: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      sessions: { select: { createdAt: true, expiresAt: true, lastUsedAt: true } },
      ownedRecipes: { include: { ingredients: true } },
      cookSessions: { include: { recipe: { select: { title: true } } } },
      cookStats: true,
      favorites: { include: { recipe: { select: { title: true } } } },
      reviews: true,
      shoppingItems: true,
      weeklyMenuPlans: true,
      sharesSent: true,
      recipeRequestsSent: true,
      howToLessonProgress: true,
      howToBadges: { include: { badge: { select: { slug: true, title: true } } } },
      activeDays: { select: { day: true }, orderBy: { day: "asc" } },
    },
  });
  if (!user) throw new AdminActionError("User not found", 404);
  const { passwordHash: _omit, ...profile } = user;
  void _omit;
  const householdIds = user.memberships.map((m) => m.householdId);
  const pantryItems = householdIds.length
    ? await prisma.pantryItem.findMany({ where: { householdId: { in: householdIds } } })
    : [];
  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    note: "FridgeForge account export. Password hash and session/reset tokens are excluded.",
    user: {
      ...profile,
      hasPassword: Boolean(user.passwordHash),
      activeDays: user.activeDays.map((d) => d.day.toISOString().slice(0, 10)),
    },
    pantryItemsByHousehold: householdIds.map((id) => ({
      householdId: id,
      items: pantryItems.filter((p) => p.householdId === id),
    })),
  };
}

export async function recordExport(actorId: string, targetId: string) {
  await writeAudit(prisma, { actorId, targetUserId: targetId, action: "user.export" });
}

export async function hasRecentExport(
  db: AuditDb,
  actorId: string,
  targetId: string,
  now: Date = new Date()
): Promise<boolean> {
  const row = await db.adminAuditLog.findFirst({
    where: {
      actorId,
      targetUserId: targetId,
      action: "user.export",
      createdAt: { gte: new Date(now.getTime() - EXPORT_BEFORE_DELETE_MS) },
    },
    select: { id: true },
  });
  return !!row;
}

// ---------------------------------------------------------------------------
// Delete

export type DeleteSummary = {
  householdsDeleted: {
    id: string;
    name: string;
    pantryItems: number;
    coupons: number;
    customStaples: number;
    privateRecipesDeleted: number;
  }[];
  ownershipTransferred: { householdId: string; toUserId: string }[];
  recipesUnlinked: number;
  cookSessionsUnlinked: number;
  /** Files to unlink after commit (best effort). */
  deletedRecipeImages: { id: string; imageUrl: string | null; originStoryMedia: string }[];
  deletedPantryImageUrls: string[];
};

/**
 * The delete itself, inside a transaction:
 * - guards: typed-email confirm, export-first, not self, not the last admin
 * - households where the user is the only member are deleted, together with
 *   their household-scoped private data (pantry, coupons, custom staples and
 *   non-global recipes). Without that, current FK rules (SET NULL) would move
 *   those rows into the shared guest/catalog scope (householdId = null).
 * - households with other members are kept; ownership passes to the oldest
 *   remaining member if this user was the only owner.
 * - the user row is deleted: sessions, memberships, favorites, reviews, shopping
 *   items, menus, sent shares/requests, how-to progress, badges, activity days
 *   and reset tokens cascade; owned recipes and cook history are kept with the
 *   user cleared (SET NULL).
 */
export async function deleteUserInTx(
  tx: Prisma.TransactionClient,
  actorId: string,
  targetId: string,
  confirmEmail: string,
  now: Date = new Date()
): Promise<DeleteSummary> {
  const user = await tx.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      email: true,
      role: true,
      disabled: true,
      memberships: {
        select: {
          id: true,
          role: true,
          householdId: true,
          household: {
            select: {
              id: true,
              name: true,
              members: {
                orderBy: { createdAt: "asc" },
                select: { id: true, userId: true, role: true },
              },
            },
          },
        },
      },
    },
  });
  if (!user) throw new AdminActionError("User not found", 404);
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new AdminActionError("Type the user's email exactly to confirm");
  }
  const guard = guardDelete(actorId, user, await countActiveAdmins(tx));
  if (guard) throw new AdminActionError(guard);
  if (!(await hasRecentExport(tx, actorId, targetId, now))) {
    throw new AdminActionError("Export the user's data first", 409);
  }

  const summary: DeleteSummary = {
    householdsDeleted: [],
    ownershipTransferred: [],
    recipesUnlinked: 0,
    cookSessionsUnlinked: 0,
    deletedRecipeImages: [],
    deletedPantryImageUrls: [],
  };

  for (const m of user.memberships) {
    const others = m.household.members.filter((x) => x.userId !== user.id);
    if (others.length === 0) {
      const hid = m.householdId;
      const pantryImgs = await tx.pantryItem.findMany({
        where: { householdId: hid, imageUrl: { not: null } },
        select: { imageUrl: true },
      });
      const privateWhere = { householdId: hid, visibility: { notIn: ["global", "public"] } };
      const privateRecipes = await tx.recipe.findMany({
        where: privateWhere,
        select: { id: true, imageUrl: true, originStoryMedia: true },
      });
      const pantry = await tx.pantryItem.deleteMany({ where: { householdId: hid } });
      const coupons = await tx.coupon.deleteMany({ where: { householdId: hid } });
      const staples = await tx.customPantryStaple.deleteMany({ where: { householdId: hid } });
      const recipes = await tx.recipe.deleteMany({ where: privateWhere });
      await tx.household.delete({ where: { id: hid } });
      summary.householdsDeleted.push({
        id: hid,
        name: m.household.name,
        pantryItems: pantry.count,
        coupons: coupons.count,
        customStaples: staples.count,
        privateRecipesDeleted: recipes.count,
      });
      summary.deletedRecipeImages.push(...privateRecipes);
      summary.deletedPantryImageUrls.push(
        ...pantryImgs.map((p) => p.imageUrl).filter((u): u is string => !!u)
      );
    } else if (m.role === "owner" && !others.some((o) => o.role === "owner")) {
      const heir = others[0]!;
      await tx.householdMember.update({ where: { id: heir.id }, data: { role: "owner" } });
      summary.ownershipTransferred.push({ householdId: m.householdId, toUserId: heir.userId });
    }
  }

  summary.recipesUnlinked = await tx.recipe.count({ where: { ownerUserId: user.id } });
  summary.cookSessionsUnlinked = await tx.recipeCookSession.count({ where: { userId: user.id } });

  // Pending shares addressed to this person by email would otherwise attach to
  // whoever registers that address next.
  await tx.recipeShare.deleteMany({
    where: { OR: [{ toUserId: user.id }, { toUserEmail: user.email.toLowerCase() }] },
  });
  await tx.user.delete({ where: { id: user.id } });

  await writeAudit(tx, {
    actorId,
    targetUserId: user.id,
    action: "user.delete",
    details: {
      emailSha256: emailHash(user.email),
      role: user.role,
      householdsDeleted: summary.householdsDeleted,
      ownershipTransferred: summary.ownershipTransferred,
      recipesUnlinked: summary.recipesUnlinked,
      cookSessionsUnlinked: summary.cookSessionsUnlinked,
    },
  });
  return summary;
}

export async function deleteUser(actorId: string, targetId: string, confirmEmail: string) {
  const summary = await prisma.$transaction(
    (tx) => deleteUserInTx(tx, actorId, targetId, confirmEmail),
    { ...SERIALIZABLE, timeout: 20_000 }
  );
  // Best-effort file cleanup after commit.
  for (const r of summary.deletedRecipeImages) {
    await deleteOrphanedRecipeImages(r);
  }
  for (const url of new Set(summary.deletedPantryImageUrls)) {
    const stillUsed = await prisma.pantryItem.count({ where: { imageUrl: url } });
    if (!stillUsed) await deleteManagedPantryUserImage(url);
  }
  return summary;
}
