import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { AdminActionError, deleteUserInTx, emailHash } from "@/lib/admin-users";

const NOW = new Date("2026-10-06T12:00:00.000Z");

type Member = { id: string; userId: string; role: string };
type Membership = {
  id: string;
  role: string;
  householdId: string;
  household: { id: string; name: string; members: Member[] };
};

function makeTx(opts: {
  user: { id: string; email: string; role: string; disabled: boolean; memberships: Membership[] } | null;
  activeAdmins?: number;
  exported?: boolean;
}) {
  const calls: string[] = [];
  const rec =
    (name: string, value: unknown = { count: 2 }) =>
    vi.fn(async (..._args: unknown[]) => {
      calls.push(name);
      return value;
    });
  const tx = {
    user: {
      findUnique: rec("user.findUnique", opts.user),
      count: rec("user.count", opts.activeAdmins ?? 2),
      delete: rec("user.delete", {}),
    },
    adminAuditLog: {
      findFirst: rec("audit.findFirst", opts.exported === false ? null : { id: "exp1" }),
      create: rec("audit.create", {}),
    },
    pantryItem: {
      findMany: rec("pantry.findMany", [{ imageUrl: "/pantry-images/user/a.jpg" }]),
      deleteMany: rec("pantry.deleteMany", { count: 7 }),
    },
    coupon: { deleteMany: rec("coupon.deleteMany", { count: 1 }) },
    customPantryStaple: { deleteMany: rec("staple.deleteMany", { count: 0 }) },
    recipe: {
      findMany: rec("recipe.findMany", [{ id: "r9", imageUrl: null, originStoryMedia: "[]" }]),
      deleteMany: rec("recipe.deleteMany", { count: 1 }),
      count: rec("recipe.count", 4),
    },
    household: { delete: rec("household.delete", {}) },
    householdMember: { update: rec("member.update", {}) },
    recipeCookSession: { count: rec("cook.count", 5) },
    recipeShare: { deleteMany: rec("share.deleteMany", { count: 0 }) },
  };
  return { tx, calls };
}

const soloHousehold: Membership = {
  id: "m1",
  role: "owner",
  householdId: "h1",
  household: { id: "h1", name: "Solo Kitchen", members: [{ id: "m1", userId: "u1", role: "owner" }] },
};
const sharedHousehold: Membership = {
  id: "m2",
  role: "owner",
  householdId: "h2",
  household: {
    id: "h2",
    name: "Shared Kitchen",
    members: [
      { id: "m2", userId: "u1", role: "owner" },
      { id: "m3", userId: "u2", role: "member" },
      { id: "m4", userId: "u3", role: "member" },
    ],
  },
};
const baseUser = { id: "u1", email: "Target@Example.com", role: "user", disabled: false, memberships: [] as Membership[] };

describe("deleteUserInTx", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "error").mockImplementation(() => {});
    return () => warn.mockRestore();
  });

  it("deletes a household left with no members (and its private data) before deleting the user", async () => {
    const { tx, calls } = makeTx({ user: { ...baseUser, memberships: [soloHousehold] } });
    const s = await deleteUserInTx(tx as never, "admin", "u1", "target@example.com ", NOW);

    expect(tx.pantryItem.deleteMany).toHaveBeenCalledWith({ where: { householdId: "h1" } });
    expect(tx.coupon.deleteMany).toHaveBeenCalledWith({ where: { householdId: "h1" } });
    expect(tx.customPantryStaple.deleteMany).toHaveBeenCalledWith({ where: { householdId: "h1" } });
    expect(tx.recipe.deleteMany).toHaveBeenCalledWith({
      where: { householdId: "h1", visibility: { notIn: ["global", "public"] } },
    });
    expect(tx.household.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
    expect(calls.indexOf("household.delete")).toBeLessThan(calls.indexOf("user.delete"));
    expect(calls.indexOf("user.delete")).toBeLessThan(calls.indexOf("audit.create"));
    expect(s.householdsDeleted).toEqual([
      { id: "h1", name: "Solo Kitchen", pantryItems: 7, coupons: 1, customStaples: 0, privateRecipesDeleted: 1 },
    ]);
    expect(s.deletedPantryImageUrls).toEqual(["/pantry-images/user/a.jpg"]);
    expect(s.recipesUnlinked).toBe(4);
    expect(s.cookSessionsUnlinked).toBe(5);
    // owned recipes / cook history are not deleted here — FK SET NULL keeps them
    expect(tx.recipe.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("keeps a household with other members and hands ownership to the oldest remaining member", async () => {
    const { tx } = makeTx({ user: { ...baseUser, memberships: [sharedHousehold] } });
    const s = await deleteUserInTx(tx as never, "admin", "u1", "target@example.com", NOW);
    expect(tx.household.delete).not.toHaveBeenCalled();
    expect(tx.pantryItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.householdMember.update).toHaveBeenCalledWith({ where: { id: "m3" }, data: { role: "owner" } });
    expect(s.ownershipTransferred).toEqual([{ householdId: "h2", toUserId: "u2" }]);
  });

  it("removes pending shares addressed to the deleted email and writes an audit entry without the raw email", async () => {
    const { tx } = makeTx({ user: { ...baseUser } });
    await deleteUserInTx(tx as never, "admin", "u1", "TARGET@example.com", NOW);
    expect(tx.recipeShare.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ toUserId: "u1" }, { toUserEmail: "target@example.com" }] },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
    const audit = (tx.adminAuditLog.create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(audit).toMatchObject({ actorId: "admin", targetUserId: "u1", action: "user.delete" });
    expect(JSON.stringify(audit)).not.toContain("example.com");
    expect((audit.details as Record<string, unknown>).emailSha256).toBe(emailHash("target@example.com"));
  });

  it("requires the typed email", async () => {
    const { tx } = makeTx({ user: { ...baseUser } });
    await expect(deleteUserInTx(tx as never, "admin", "u1", "someone@else.com", NOW)).rejects.toThrow(/Type the user's email/);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("requires a recent export by this admin", async () => {
    const { tx } = makeTx({ user: { ...baseUser }, exported: false });
    const err = await deleteUserInTx(tx as never, "admin", "u1", "target@example.com", NOW).catch((e) => e);
    expect(err).toBeInstanceOf(AdminActionError);
    expect(err.status).toBe(409);
    const where = (tx.adminAuditLog.findFirst.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ actorId: "admin", targetUserId: "u1", action: "user.export" });
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("refuses self-delete and deleting the last admin", async () => {
    const self = makeTx({ user: { ...baseUser, id: "admin", role: "admin" } });
    await expect(deleteUserInTx(self.tx as never, "admin", "admin", "target@example.com", NOW)).rejects.toThrow(
      "You can't delete yourself"
    );
    const last = makeTx({ user: { ...baseUser, role: "admin" }, activeAdmins: 1 });
    await expect(deleteUserInTx(last.tx as never, "admin", "u1", "target@example.com", NOW)).rejects.toThrow(
      "Can't delete the last admin"
    );
    expect(last.tx.user.delete).not.toHaveBeenCalled();
  });

  it("404s for a missing user", async () => {
    const { tx } = makeTx({ user: null });
    const err = await deleteUserInTx(tx as never, "admin", "nope", "x@y.z", NOW).catch((e) => e);
    expect(err.status).toBe(404);
  });
});
