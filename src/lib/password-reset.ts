import { createHash, randomBytes } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/** Admin-issued reset links are valid for one hour and single-use. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** 32 random bytes, URL-safe. Only the hash is ever stored. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

/** Cheap shape check before touching the DB. */
export function looksLikeResetToken(raw: unknown): raw is string {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(raw);
}

export type ResetTokenRow = { expiresAt: Date; usedAt: Date | null };

export function isResetTokenUsable(
  row: ResetTokenRow | null | undefined,
  now: Date = new Date()
): boolean {
  return !!row && row.usedAt == null && row.expiresAt.getTime() > now.getTime();
}

export function resetLinkUrl(baseUrl: string, raw: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(raw)}`;
}

type Db = Pick<PrismaClient, "passwordResetToken">;

/**
 * Create a fresh link for userId. Any earlier unused links for the same user
 * are invalidated so only the newest one works.
 */
export async function issueResetToken(
  db: Db,
  userId: string,
  createdById: string,
  now: Date = new Date()
): Promise<{ raw: string; expiresAt: Date }> {
  const { raw, hash } = generateResetToken();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);
  await db.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now },
  });
  await db.passwordResetToken.create({
    data: { userId, tokenHash: hash, expiresAt, createdById },
  });
  return { raw, expiresAt };
}

export type ConsumeResult =
  | { ok: true; userId: string; sessionsRevoked: number }
  | { ok: false; error: "invalid" | "expired" };

type Tx = Pick<Prisma.TransactionClient, "passwordResetToken" | "user" | "session">;

/**
 * Inside a transaction: claim the token (race-safe conditional update), set the
 * new password hash, invalidate every other outstanding token and delete all
 * of the user's sessions.
 */
export async function consumeResetToken(
  tx: Tx,
  raw: string,
  passwordHash: string,
  now: Date = new Date()
): Promise<ConsumeResult> {
  if (!looksLikeResetToken(raw)) return { ok: false, error: "invalid" };
  const tokenHash = hashResetToken(raw);
  const row = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row) return { ok: false, error: "invalid" };
  if (!isResetTokenUsable(row, now)) {
    return { ok: false, error: row.usedAt ? "invalid" : "expired" };
  }
  const claimed = await tx.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return { ok: false, error: "invalid" };

  await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
  await tx.passwordResetToken.updateMany({
    where: { userId: row.userId, usedAt: null },
    data: { usedAt: now },
  });
  const sessions = await tx.session.deleteMany({ where: { userId: row.userId } });
  return { ok: true, userId: row.userId, sessionsRevoked: sessions.count };
}
