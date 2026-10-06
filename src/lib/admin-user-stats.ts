import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the week containing d (matches Postgres date_trunc('week')). */
export function weekStartUTC(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (day.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(day.getTime() - dow * DAY_MS);
}

export type WeekBucket = { weekStart: string; count: number };

/** Oldest → newest `weeks` buckets ending with the current week; missing weeks are 0. */
export function fillWeeklyBuckets(
  rows: { week: Date; n: number | bigint }[],
  weeks: number,
  now: Date = new Date()
): WeekBucket[] {
  const byKey = new Map<string, number>();
  for (const r of rows) {
    const key = weekStartUTC(new Date(r.week)).toISOString().slice(0, 10);
    byKey.set(key, (byKey.get(key) ?? 0) + Number(r.n));
  }
  const current = weekStartUTC(now);
  const out: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const key = new Date(current.getTime() - i * 7 * DAY_MS).toISOString().slice(0, 10);
    out.push({ weekStart: key, count: byKey.get(key) ?? 0 });
  }
  return out;
}

export type UserStats = {
  total: number;
  newLast30: number;
  signupsByWeek: WeekBucket[];
  active7: number;
  active30: number;
  weeklyActive: WeekBucket[];
};

export async function getUserStats(now: Date = new Date(), weeks = 8): Promise<UserStats> {
  const since = new Date(weekStartUTC(now).getTime() - (weeks - 1) * 7 * DAY_MS);
  const [total, newLast30, active7, active30, signupRows, activeRows] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
    prisma.$queryRaw<{ week: Date; n: number }[]>`
      SELECT date_trunc('week', "createdAt") AS week, COUNT(*)::int AS n
      FROM "User" WHERE "createdAt" >= ${since}
      GROUP BY 1`,
    prisma.$queryRaw<{ week: Date; n: number }[]>`
      SELECT date_trunc('week', "day"::timestamp) AS week, COUNT(DISTINCT "userId")::int AS n
      FROM "UserActiveDay" WHERE "day" >= ${since}::date
      GROUP BY 1`,
  ]);
  return {
    total,
    newLast30,
    signupsByWeek: fillWeeklyBuckets(signupRows, weeks, now),
    active7,
    active30,
    weeklyActive: fillWeeklyBuckets(activeRows, weeks, now),
  };
}
