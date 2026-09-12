export type BadgeKind = "howto" | "manual";

export function normalizeBadgeKind(
  kind: string | null | undefined
): BadgeKind {
  return kind === "manual" ? "manual" : "howto";
}

/** Split awards for Account / public profile section labels. */
export function partitionUserBadges<T extends { kind: string }>(
  badges: T[]
): { howto: T[]; awards: T[] } {
  const howto: T[] = [];
  const awards: T[] = [];
  for (const b of badges) {
    if (normalizeBadgeKind(b.kind) === "manual") awards.push(b);
    else howto.push(b);
  }
  return { howto, awards };
}

export function slugifyBadgeTitle(title: string): string {
  const s = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s.length >= 2 ? s : "badge";
}
