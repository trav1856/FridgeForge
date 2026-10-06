import { describe, expect, it, vi } from "vitest";
import {
  consumeResetToken,
  generateResetToken,
  hashResetToken,
  isResetTokenUsable,
  issueResetToken,
  looksLikeResetToken,
  resetLinkUrl,
  RESET_TOKEN_TTL_MS,
} from "@/lib/password-reset";

const NOW = new Date("2026-10-06T12:00:00.000Z");

describe("reset token basics", () => {
  it("generates url-safe random tokens and stores only a sha256 hash", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a.raw).not.toBe(b.raw);
    expect(looksLikeResetToken(a.raw)).toBe(true);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashResetToken(a.raw));
    expect(a.hash).not.toContain(a.raw);
  });

  it("rejects malformed tokens early", () => {
    expect(looksLikeResetToken("")).toBe(false);
    expect(looksLikeResetToken("short")).toBe(false);
    expect(looksLikeResetToken("x".repeat(40) + "'; drop")).toBe(false);
    expect(looksLikeResetToken(42)).toBe(false);
  });

  it("is usable only before expiry and before use", () => {
    const fresh = { expiresAt: new Date(NOW.getTime() + 1000), usedAt: null };
    expect(isResetTokenUsable(fresh, NOW)).toBe(true);
    expect(isResetTokenUsable({ ...fresh, expiresAt: NOW }, NOW)).toBe(false);
    expect(isResetTokenUsable({ ...fresh, usedAt: NOW }, NOW)).toBe(false);
    expect(isResetTokenUsable(null, NOW)).toBe(false);
  });

  it("builds the public link", () => {
    expect(resetLinkUrl("https://ff.example/", "abc_DEF-123")).toBe("https://ff.example/reset-password?token=abc_DEF-123");
  });
});

describe("issueResetToken", () => {
  it("invalidates older unused links and stores a 1-hour hashed token", async () => {
    const db = {
      passwordResetToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const { raw, expiresAt } = await issueResetToken(db as never, "u1", "admin1", NOW);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(RESET_TOKEN_TTL_MS);
    expect(db.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", usedAt: null },
      data: { usedAt: NOW },
    });
    const created = db.passwordResetToken.create.mock.calls[0]![0].data;
    expect(created).toEqual({ userId: "u1", tokenHash: hashResetToken(raw), expiresAt, createdById: "admin1" });
    expect(JSON.stringify(created)).not.toContain(raw);
  });
});

function fakeTx(row: { id: string; userId: string; expiresAt: Date; usedAt: Date | null } | null, claimCount = 1) {
  return {
    passwordResetToken: {
      findUnique: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValueOnce({ count: claimCount }).mockResolvedValue({ count: 0 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  };
}

describe("consumeResetToken", () => {
  const { raw } = generateResetToken();

  it("sets the password, burns the token, invalidates others and ends all sessions", async () => {
    const tx = fakeTx({ id: "t1", userId: "u1", expiresAt: new Date(NOW.getTime() + 60_000), usedAt: null });
    const r = await consumeResetToken(tx as never, raw, "HASH", NOW);
    expect(r).toEqual({ ok: true, userId: "u1", sessionsRevoked: 3 });
    expect(tx.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashResetToken(raw) } });
    expect(tx.passwordResetToken.updateMany.mock.calls[0]![0]).toEqual({
      where: { id: "t1", usedAt: null, expiresAt: { gt: NOW } },
      data: { usedAt: NOW },
    });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { passwordHash: "HASH" } });
    expect(tx.passwordResetToken.updateMany.mock.calls[1]![0]).toEqual({
      where: { userId: "u1", usedAt: null },
      data: { usedAt: NOW },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });

  it("rejects unknown, used and expired tokens without touching the user", async () => {
    for (const [row, err] of [
      [null, "invalid"],
      [{ id: "t", userId: "u", expiresAt: new Date(NOW.getTime() + 1000), usedAt: NOW }, "invalid"],
      [{ id: "t", userId: "u", expiresAt: new Date(NOW.getTime() - 1), usedAt: null }, "expired"],
    ] as const) {
      const tx = fakeTx(row as never);
      expect(await consumeResetToken(tx as never, raw, "HASH", NOW)).toEqual({ ok: false, error: err });
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.session.deleteMany).not.toHaveBeenCalled();
    }
  });

  it("loses the race safely when another request claimed it first", async () => {
    const tx = fakeTx({ id: "t1", userId: "u1", expiresAt: new Date(NOW.getTime() + 60_000), usedAt: null }, 0);
    expect(await consumeResetToken(tx as never, raw, "HASH", NOW)).toEqual({ ok: false, error: "invalid" });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("rejects malformed input without a DB lookup", async () => {
    const tx = fakeTx(null);
    expect(await consumeResetToken(tx as never, "bad token", "HASH", NOW)).toEqual({ ok: false, error: "invalid" });
    expect(tx.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });
});
