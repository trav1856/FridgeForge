import { prisma } from "@/lib/db";
import {
  BUDGET_GROCERY_TIPS,
  KIDS_MEAL_DEALS,
  NON_RESTAURANT_KID_FOOD,
  tipDetailBody,
  kidsMealDetailBody,
} from "@/lib/struggle-content";

export type StruggleKind = "tip" | "kids_meal";

export type StruggleLink = { label: string; url: string };

export type StruggleResourceDTO = {
  id: string;
  kind: StruggleKind;
  title: string;
  slug: string;
  summary: string;
  body: string;
  links: StruggleLink[];
  whenLabel: string | null;
  sortOrder: number;
  published: boolean;
  updatedAt: string;
};

export class StruggleAdminError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "StruggleAdminError";
    this.status = status;
  }
}

export function slugifyStruggleTitle(raw: string): string {
  const s = (raw || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return s || "resource";
}

export function parseStruggleLinks(raw: unknown): StruggleLink[] {
  let arr: unknown[] = [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  }
  const out: StruggleLink[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const label = String((item as { label?: unknown }).label ?? "").trim();
    const url = String((item as { url?: unknown }).url ?? "").trim();
    if (!label || !url) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    out.push({ label: label.slice(0, 80), url: url.slice(0, 500) });
    if (out.length >= 12) break;
  }
  return out;
}

export function normalizeStruggleKind(raw: unknown): StruggleKind | null {
  const k = String(raw ?? "").trim();
  if (k === "tip" || k === "kids_meal") return k;
  return null;
}

type Row = {
  id: string;
  kind: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  linksJson: string;
  whenLabel: string | null;
  sortOrder: number;
  published: boolean;
  updatedAt: Date;
};

export function serializeStruggleResource(row: Row): StruggleResourceDTO {
  const kind = normalizeStruggleKind(row.kind) ?? "tip";
  return {
    id: row.id,
    kind,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    links: parseStruggleLinks(row.linksJson),
    whenLabel: row.whenLabel,
    sortOrder: row.sortOrder,
    published: row.published,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function uniquifyStruggleSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  const root = slugifyStruggleTitle(base);
  let candidate = root;
  let n = 1;
  for (;;) {
    const existing = await prisma.struggleResource.findUnique({
      where: { slug: candidate },
    });
    if (!existing || existing.id === excludeId) return candidate;
    n += 1;
    candidate = `${root.slice(0, Math.max(1, 64 - String(n).length - 1))}-${n}`;
  }
}

export async function listPublishedStruggleResources(opts?: {
  kind?: StruggleKind;
}): Promise<StruggleResourceDTO[]> {
  const rows = await prisma.struggleResource.findMany({
    where: {
      published: true,
      ...(opts?.kind ? { kind: opts.kind } : {}),
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(serializeStruggleResource);
}

export async function getPublishedStruggleBySlug(
  slug: string
): Promise<StruggleResourceDTO | null> {
  const row = await prisma.struggleResource.findFirst({
    where: { slug, published: true },
  });
  return row ? serializeStruggleResource(row) : null;
}

export async function getStruggleBySlugAny(
  slug: string
): Promise<StruggleResourceDTO | null> {
  const row = await prisma.struggleResource.findUnique({ where: { slug } });
  return row ? serializeStruggleResource(row) : null;
}

export async function listAdminStruggleResources(): Promise<
  StruggleResourceDTO[]
> {
  const rows = await prisma.struggleResource.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(serializeStruggleResource);
}

export async function createStruggleResource(input: {
  kind: StruggleKind;
  title: string;
  slug?: string | null;
  summary: string;
  body?: string | null;
  links?: StruggleLink[] | null;
  whenLabel?: string | null;
  sortOrder?: number | null;
  published?: boolean | null;
}): Promise<StruggleResourceDTO> {
  const kind = normalizeStruggleKind(input.kind);
  if (!kind) throw new StruggleAdminError("kind must be tip or kids_meal");
  const title = input.title.trim();
  if (title.length < 1 || title.length > 120) {
    throw new StruggleAdminError("Title must be 1–120 characters.");
  }
  const summary = input.summary.trim();
  if (summary.length < 1 || summary.length > 600) {
    throw new StruggleAdminError("Summary must be 1–600 characters.");
  }
  const body = (input.body ?? "").trim();
  if (body.length > 20000) {
    throw new StruggleAdminError("Body must be ≤20000 characters.");
  }
  const slug = await uniquifyStruggleSlug(input.slug?.trim() || title);
  const links = parseStruggleLinks(input.links ?? []);
  const whenLabel = input.whenLabel?.trim() || null;
  const sortOrder =
    input.sortOrder === null || input.sortOrder === undefined
      ? await nextSortOrder(kind)
      : Math.max(0, Math.floor(Number(input.sortOrder) || 0));
  const published = input.published !== false;

  const created = await prisma.struggleResource.create({
    data: {
      kind,
      title,
      slug,
      summary,
      body,
      linksJson: JSON.stringify(links),
      whenLabel,
      sortOrder,
      published,
    },
  });
  return serializeStruggleResource(created);
}

async function nextSortOrder(kind: StruggleKind): Promise<number> {
  const agg = await prisma.struggleResource.aggregate({
    where: { kind },
    _max: { sortOrder: true },
  });
  return (agg._max.sortOrder ?? 0) + 1;
}

export async function updateStruggleResource(
  id: string,
  input: {
    kind?: StruggleKind;
    title?: string;
    slug?: string | null;
    summary?: string;
    body?: string | null;
    links?: StruggleLink[] | null;
    whenLabel?: string | null;
    sortOrder?: number | null;
    published?: boolean | null;
  }
): Promise<StruggleResourceDTO> {
  const existing = await prisma.struggleResource.findUnique({ where: { id } });
  if (!existing) throw new StruggleAdminError("Not found.", 404);

  const data: {
    kind?: string;
    title?: string;
    slug?: string;
    summary?: string;
    body?: string;
    linksJson?: string;
    whenLabel?: string | null;
    sortOrder?: number;
    published?: boolean;
  } = {};

  if (input.kind !== undefined) {
    const kind = normalizeStruggleKind(input.kind);
    if (!kind) throw new StruggleAdminError("kind must be tip or kids_meal");
    data.kind = kind;
  }
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 120) {
      throw new StruggleAdminError("Title must be 1–120 characters.");
    }
    data.title = title;
  }
  if (input.summary !== undefined) {
    const summary = input.summary.trim();
    if (summary.length < 1 || summary.length > 600) {
      throw new StruggleAdminError("Summary must be 1–600 characters.");
    }
    data.summary = summary;
  }
  if (input.body !== undefined) {
    const body = (input.body ?? "").trim();
    if (body.length > 20000) {
      throw new StruggleAdminError("Body must be ≤20000 characters.");
    }
    data.body = body;
  }
  if (input.links !== undefined) {
    data.linksJson = JSON.stringify(parseStruggleLinks(input.links ?? []));
  }
  if (input.whenLabel !== undefined) {
    data.whenLabel = input.whenLabel?.trim() || null;
  }
  if (input.sortOrder !== undefined && input.sortOrder !== null) {
    data.sortOrder = Math.max(0, Math.floor(Number(input.sortOrder) || 0));
  }
  if (input.published !== undefined && input.published !== null) {
    data.published = Boolean(input.published);
  }
  if (input.slug !== undefined && input.slug !== null && input.slug.trim()) {
    data.slug = await uniquifyStruggleSlug(input.slug.trim(), id);
  }

  const updated = await prisma.struggleResource.update({
    where: { id },
    data,
  });
  return serializeStruggleResource(updated);
}

export async function deleteStruggleResource(id: string): Promise<void> {
  const existing = await prisma.struggleResource.findUnique({ where: { id } });
  if (!existing) throw new StruggleAdminError("Not found.", 404);
  await prisma.struggleResource.delete({ where: { id } });
}

/** Seed rows from static catalog — create missing by slug only (non-destructive). */
export function buildStruggleSeedRows(): {
  kind: StruggleKind;
  title: string;
  slug: string;
  summary: string;
  body: string;
  links: StruggleLink[];
  whenLabel: string | null;
  sortOrder: number;
  published: boolean;
}[] {
  const tips = BUDGET_GROCERY_TIPS.map((t, i) => ({
    kind: "tip" as const,
    title: t.title,
    slug: t.id,
    summary: t.body,
    body: tipDetailBody(t.id, t.title, t.body),
    links: [] as StruggleLink[],
    whenLabel: null,
    sortOrder: i + 1,
    published: true,
  }));

  const kids = KIDS_MEAL_DEALS.map((d, i) => ({
    kind: "kids_meal" as const,
    title: d.place,
    slug: d.id,
    summary: d.note,
    body: kidsMealDetailBody(d.id, d.place, d.note, d.when),
    links: [] as StruggleLink[],
    whenLabel: d.when ?? null,
    sortOrder: i + 1,
    published: true,
  }));

  const extra = {
    kind: "kids_meal" as const,
    title: NON_RESTAURANT_KID_FOOD.title,
    slug: "usda-pantries",
    summary: NON_RESTAURANT_KID_FOOD.body.slice(0, 280),
    body: `${NON_RESTAURANT_KID_FOOD.body}

Search “[USDA Summer Meals near me](https://www.fns.usda.gov/sfsp/summer-food-service-program)” or dial 211 for pantry and meal-site hours in your area. School districts often post free breakfast/lunch calendars during the school year.`,
    links: [
      {
        label: "USDA Summer Food Service Program",
        url: "https://www.fns.usda.gov/sfsp/summer-food-service-program",
      },
    ] as StruggleLink[],
    whenLabel: null,
    sortOrder: KIDS_MEAL_DEALS.length + 1,
    published: true,
  };

  return [...tips, ...kids, extra];
}

/**
 * Upsert seed catalog by slug. Creates missing rows; does not overwrite
 * admin-edited title/summary/body/links when the row already exists
 * (unless forceUpdateContent is true).
 */
export async function ensureStruggleResourcesSeeded(opts?: {
  forceUpdateContent?: boolean;
}): Promise<{ created: number; updated: number }> {
  const force = opts?.forceUpdateContent === true;
  let created = 0;
  let updated = 0;
  for (const row of buildStruggleSeedRows()) {
    const existing = await prisma.struggleResource.findUnique({
      where: { slug: row.slug },
    });
    if (!existing) {
      await prisma.struggleResource.create({
        data: {
          kind: row.kind,
          title: row.title,
          slug: row.slug,
          summary: row.summary,
          body: row.body,
          linksJson: JSON.stringify(row.links),
          whenLabel: row.whenLabel,
          sortOrder: row.sortOrder,
          published: row.published,
        },
      });
      created += 1;
    } else if (force) {
      await prisma.struggleResource.update({
        where: { id: existing.id },
        data: {
          kind: row.kind,
          title: row.title,
          summary: row.summary,
          body: row.body,
          linksJson: JSON.stringify(row.links),
          whenLabel: row.whenLabel,
          sortOrder: row.sortOrder,
          published: row.published,
        },
      });
      updated += 1;
    }
  }
  return { created, updated };
}

