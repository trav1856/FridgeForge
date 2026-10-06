import { prisma } from "@/lib/db";

/** Throttle: write lastActiveAt / activity day at most once per this window per user. */
export const ACTIVITY_TOUCH_MS = 5 * 60 * 1000;

/** True when lastActiveAt is missing or older than the throttle window. */
export function shouldTouchActivity(
  lastActiveAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastActiveAt) return true;
  return now.getTime() - lastActiveAt.getTime() >= ACTIVITY_TOUCH_MS;
}

/** UTC calendar day (midnight UTC) used as the UserActiveDay key. */
export function activityDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function upsertActiveDay(userId: string, now: Date) {
  const day = activityDay(now);
  await prisma.userActiveDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day },
    update: {},
  });
}

/**
 * Called from getCurrentUser() only when shouldTouchActivity() is true, so the
 * common request path does zero writes. The conditional updateMany makes
 * concurrent requests race-safe (only one of them wins and writes the rest).
 */
export async function touchActivity(
  userId: string,
  sessionId: string | null,
  now: Date = new Date()
): Promise<boolean> {
  const threshold = new Date(now.getTime() - ACTIVITY_TOUCH_MS);
  const res = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: threshold } }],
    },
    data: { lastActiveAt: now },
  });
  if (res.count === 0) return false;
  await Promise.all([
    sessionId
      ? prisma.session.updateMany({ where: { id: sessionId }, data: { lastUsedAt: now } })
      : Promise.resolve(null),
    upsertActiveDay(userId, now),
  ]);
  return true;
}

/** Sign-in (or sign-up) succeeded: stamp lastSignInAt + lastActiveAt and today's activity row. */
export async function recordSignIn(userId: string, now: Date = new Date()): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastSignInAt: now, lastActiveAt: now },
  });
  await upsertActiveDay(userId, now);
}
