import { prisma } from "@/lib/db";
import {
  K_ANON, cleanCountries, cleanEthnicities, cleanSex, countryName, ethnicityLabel, isResearchEligible, parseList, regionForCountry,
} from "@/lib/demographics/options";

export const DIMENSIONS = [
  { id: "sex", label: "Sex" },
  { id: "ethnicity", label: "Ethnicity / heritage" },
  { id: "country", label: "Family-origin country" },
  { id: "region", label: "Family-origin region" },
] as const;
export type Dimension = (typeof DIMENSIONS)[number]["id"];

export type CohortMember = { userId: string; sex: string | null; ethnicities: string[]; countries: string[]; regions: string[] };
export type Activity = { userId: string; cuisine: string; views: number; favorites: number };

/** A metric with its user count; null values mean suppressed (fewer than k users). */
export type Cell = { users: number | null; views: number | null; favoriteUsers: number | null; favorites: number | null };
export type GroupRow = { key: string; label: string; size: number | null; suppressed: boolean; cells: Record<string, Cell> };
export type Report = {
  k: number;
  generatedAt: string;
  cohortSize: number | null;
  cuisines: string[];
  overall: Record<string, Cell>;
  dimensions: Record<Dimension, { label: string; groups: GroupRow[]; suppressedGroups: number }>;
};

function groupsFor(m: CohortMember, dim: Dimension): { key: string; label: string }[] {
  switch (dim) {
    case "sex": return m.sex ? [{ key: m.sex, label: m.sex === "male" ? "Male" : "Female" }] : [];
    case "ethnicity": return m.ethnicities.map((e) => ({ key: e, label: ethnicityLabel(e) }));
    case "country": return m.countries.map((c) => ({ key: c, label: countryName(c) }));
    case "region": return m.regions.map((r) => ({ key: r, label: r }));
  }
}

/** Pure: aggregate cell for a set of users, suppressing metrics backed by fewer than k users. */
export function cellFor(users: Set<string>, cuisine: string, byUser: Map<string, Map<string, Activity>>, k: number): Cell {
  let viewers = 0, views = 0, favUsers = 0, favorites = 0;
  for (const u of users) {
    const a = byUser.get(u)?.get(cuisine);
    if (!a) continue;
    if (a.views > 0) { viewers++; views += a.views; }
    if (a.favorites > 0) { favUsers++; favorites += a.favorites; }
  }
  return {
    users: viewers >= k ? viewers : null,
    views: viewers >= k ? views : null,
    favoriteUsers: favUsers >= k ? favUsers : null,
    favorites: favUsers >= k ? favorites : null,
  };
}

/** Pure: build the k-anonymous report. Groups (and the cohort) smaller than k are suppressed entirely. */
export function buildReport(cohort: CohortMember[], activity: Activity[], k = K_ANON, now = new Date()): Report {
  const inCohort = new Set(cohort.map((m) => m.userId));
  const byUser = new Map<string, Map<string, Activity>>();
  const cuisineCount = new Map<string, number>();
  for (const a of activity) {
    if (!inCohort.has(a.userId) || !a.cuisine) continue;
    const m = byUser.get(a.userId) ?? byUser.set(a.userId, new Map()).get(a.userId)!;
    const prev = m.get(a.cuisine);
    m.set(a.cuisine, { ...a, views: (prev?.views ?? 0) + a.views, favorites: (prev?.favorites ?? 0) + a.favorites });
  }
  for (const m of byUser.values()) for (const c of m.keys()) cuisineCount.set(c, (cuisineCount.get(c) ?? 0) + 1);
  const cuisines = [...cuisineCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  const all = new Set(inCohort);
  const cohortOk = all.size >= k;
  const overall: Record<string, Cell> = {};
  if (cohortOk) for (const c of cuisines) overall[c] = cellFor(all, c, byUser, k);

  const dimensions = {} as Report["dimensions"];
  for (const d of DIMENSIONS) {
    const members = new Map<string, { label: string; users: Set<string> }>();
    for (const m of cohort) for (const g of groupsFor(m, d.id)) {
      const e = members.get(g.key) ?? members.set(g.key, { label: g.label, users: new Set() }).get(g.key)!;
      e.users.add(m.userId);
    }
    const groups: GroupRow[] = [];
    let suppressedGroups = 0;
    for (const [key, { label, users }] of [...members.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label))) {
      if (!cohortOk || users.size < k) { suppressedGroups++; continue; } // not even listed: its label + size would leak a small group
      const cells: Record<string, Cell> = {};
      for (const c of cuisines) cells[c] = cellFor(users, c, byUser, k);
      groups.push({ key, label, size: users.size, suppressed: false, cells });
    }
    dimensions[d.id] = { label: d.label, groups, suppressedGroups };
  }
  return { k, generatedAt: now.toISOString(), cohortSize: cohortOk ? all.size : null, cuisines: cohortOk ? cuisines : [], overall, dimensions };
}

/** Eligible cohort: consented AND verified 16+. */
export async function loadCohort(): Promise<CohortMember[]> {
  const rows = await prisma.userDemographics.findMany({
    where: { researchConsent: true, age16ConfirmedAt: { not: null }, user: { disabled: false } },
    select: { userId: true, sex: true, ethnicities: true, originCountries: true, researchConsent: true, age16ConfirmedAt: true },
  });
  return rows.filter(isResearchEligible).map((r) => {
    const countries = cleanCountries(parseList(r.originCountries));
    return {
      userId: r.userId,
      sex: cleanSex(r.sex),
      ethnicities: cleanEthnicities(parseList(r.ethnicities)),
      countries,
      regions: [...new Set(countries.map(regionForCountry).filter((x): x is NonNullable<typeof x> => Boolean(x)))].sort(),
    };
  });
}

export async function loadActivity(userIds: string[]): Promise<Activity[]> {
  if (!userIds.length) return [];
  const views = await prisma.$queryRawUnsafe<{ userId: string; cuisine: string; views: bigint }[]>(
    `SELECT "userId", "cuisine", SUM("views")::bigint AS views FROM "RecipeView" WHERE "userId" = ANY($1) AND "cuisine" IS NOT NULL GROUP BY "userId", "cuisine"`,
    userIds
  );
  const favs = await prisma.$queryRawUnsafe<{ userId: string; cuisine: string; favorites: bigint }[]>(
    `SELECT f."userId", r."cuisine", COUNT(*)::bigint AS favorites FROM "RecipeFavorite" f JOIN "Recipe" r ON r."id" = f."recipeId" WHERE f."userId" = ANY($1) AND r."cuisine" IS NOT NULL GROUP BY f."userId", r."cuisine"`,
    userIds
  );
  return [
    ...views.map((v) => ({ userId: v.userId, cuisine: v.cuisine, views: Number(v.views), favorites: 0 })),
    ...favs.map((f) => ({ userId: f.userId, cuisine: f.cuisine, views: 0, favorites: Number(f.favorites) })),
  ];
}

export async function currentReport(k = K_ANON): Promise<Report> {
  const cohort = await loadCohort();
  return buildReport(cohort, await loadActivity(cohort.map((c) => c.userId)), k);
}
