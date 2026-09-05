import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";

export const SESSION_COOKIE = "ff_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;

export type AuthUser = User & {
  memberships: {
    id: string;
    role: string;
    householdId: string;
    household: { id: string; name: string; inviteCode: string };
  }[];
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export { generateInviteCode } from "@/lib/household";

export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { token, userId, expiresAt },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

const userInclude = {
  memberships: {
    include: {
      household: { select: { id: true, name: true, inviteCode: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: userInclude } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user as AuthUser;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Unauthorized");
  }
  return user;
}

export class AuthError extends Error {
  status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

/** First household membership id, or null (guest / no household yet). */
export function getActiveHouseholdId(user: AuthUser | null): string | null {
  if (!user?.memberships?.length) return null;
  return user.memberships[0]!.householdId;
}

/** Resolve household scope for a request: auth+household → id, else null (CE guest). */
export async function resolveHouseholdId(): Promise<string | null> {
  const user = await getCurrentUser();
  return getActiveHouseholdId(user);
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    createdAt: user.createdAt.toISOString(),
    households: user.memberships.map((m) => ({
      id: m.household.id,
      name: m.household.name,
      inviteCode: m.household.inviteCode,
      role: m.role,
      membershipId: m.id,
    })),
  };
}

/** Stable fingerprint helper (unused externally; kept for tests). */
export function fingerprintToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}
