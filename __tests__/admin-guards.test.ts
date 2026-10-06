import { afterEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { count: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { ensureBootstrapAdmin } from "@/lib/admin";
import { guardDelete, guardRoleChange, guardSuspend } from "@/lib/admin-users";
import { activityDay, ACTIVITY_TOUCH_MS, shouldTouchActivity } from "@/lib/activity";
import { isSameOriginRequest } from "@/lib/same-origin";

const admin = { id: "a2", role: "admin", disabled: false };
const user = { id: "u1", role: "user", disabled: false };

describe("last-admin and self guards", () => {
  it("never allows removing the last active admin", () => {
    expect(guardRoleChange("a1", admin, "user", 1)).toBe("Can't remove the last admin");
    expect(guardRoleChange("a1", admin, "user", 2)).toBeNull();
    // a suspended admin doesn't count as the last active one
    expect(guardRoleChange("a1", { ...admin, disabled: true }, "user", 1)).toBeNull();
  });

  it("an admin can't demote, suspend or delete themselves", () => {
    expect(guardRoleChange("a2", admin, "user", 5)).toBe("You can't remove your own admin role");
    expect(guardSuspend("a2", admin, 5)).toBe("You can't suspend yourself");
    expect(guardDelete("a2", admin, 5)).toBe("You can't delete yourself");
  });

  it("can't suspend or delete the last admin; regular users are fine", () => {
    expect(guardSuspend("a1", admin, 1)).toBe("Can't suspend the last admin");
    expect(guardDelete("a1", admin, 1)).toBe("Can't delete the last admin");
    expect(guardSuspend("a1", user, 1)).toBeNull();
    expect(guardDelete("a1", user, 1)).toBeNull();
    expect(guardRoleChange("a1", user, "admin", 1)).toBeNull();
    expect(guardRoleChange("a1", user, "user", 1)).toBeNull();
  });
});

describe("bootstrap admin promotion", () => {
  afterEach(() => vi.clearAllMocks());

  it("does nothing once any admin exists (demotions stick)", async () => {
    prismaMock.user.count.mockResolvedValue(1);
    expect(await ensureBootstrapAdmin(["owner@example.com"])).toBe(0);
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it("promotes bootstrap emails only when no admin exists", async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
    expect(await ensureBootstrapAdmin(["Owner@Example.com"])).toBe(1);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { email: { in: ["owner@example.com"] }, role: { not: "admin" } },
      data: { role: "admin" },
    });
  });
});

describe("activity throttle", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");
  it("touches when never active or older than 5 minutes", () => {
    expect(ACTIVITY_TOUCH_MS).toBe(5 * 60 * 1000);
    expect(shouldTouchActivity(null, now)).toBe(true);
    expect(shouldTouchActivity(new Date(now.getTime() - ACTIVITY_TOUCH_MS), now)).toBe(true);
    expect(shouldTouchActivity(new Date(now.getTime() - 60_000), now)).toBe(false);
  });
  it("activity day is the UTC date", () => {
    expect(activityDay(new Date("2026-10-06T23:59:00-05:00")).toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });
});

describe("same-origin check", () => {
  const req = (h: Record<string, string>) => ({ headers: { get: (k: string) => h[k.toLowerCase()] ?? null } });
  it("uses Sec-Fetch-Site when present", () => {
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "cross-site", origin: "https://evil.test", host: "evil.test" }))).toBe(false);
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-site" }))).toBe(false);
  });
  it("falls back to Origin vs Host / X-Forwarded-Host", () => {
    expect(isSameOriginRequest(req({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" }))).toBe(true);
    expect(isSameOriginRequest(req({ origin: "https://ff.ts.net", host: "127.0.0.1:3000", "x-forwarded-host": "ff.ts.net" }))).toBe(true);
    expect(isSameOriginRequest(req({ origin: "https://evil.test", host: "127.0.0.1:3000" }))).toBe(false);
    expect(isSameOriginRequest(req({ origin: "null", host: "127.0.0.1:3000" }))).toBe(false);
    expect(isSameOriginRequest(req({ host: "127.0.0.1:3000" }))).toBe(true);
  });
});
