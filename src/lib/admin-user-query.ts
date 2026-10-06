import type { Prisma } from "@prisma/client";

/**
 * /admin/users list: URL params ⇄ filters ⇄ Prisma where/orderBy.
 * Pure (no DB access) so it can be unit-tested.
 */

export const USER_LIST_PAGE_SIZE = 25;

export const ROLE_FILTERS = ["", "admin", "user"] as const;
export const PLAN_FILTERS = ["", "community", "pro"] as const;
export const STATUS_FILTERS = ["", "active", "suspended"] as const;
export const ACTIVE_FILTERS = ["", "7", "30", "90", "never"] as const;
export const SIGNED_UP_FILTERS = ["", "7", "30", "90", "365", "custom"] as const;
export const SORT_KEYS = ["active", "created", "name", "email", "recipes"] as const;

export type RoleFilter = (typeof ROLE_FILTERS)[number];
export type PlanFilter = (typeof PLAN_FILTERS)[number];
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type ActiveFilter = (typeof ACTIVE_FILTERS)[number];
export type SignedUpFilter = (typeof SIGNED_UP_FILTERS)[number];
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export type UserListParams = {
  q: string;
  role: RoleFilter;
  plan: PlanFilter;
  status: StatusFilter;
  active: ActiveFilter;
  /** Preset day window, or "custom" (uses from/to). */
  signedUp: SignedUpFilter;
  /** YYYY-MM-DD (inclusive), only with signedUp=custom. */
  from: string;
  to: string;
  sort: SortKey;
  dir: SortDir;
  page: number;
};

export const DEFAULT_USER_LIST_PARAMS: UserListParams = {
  q: "",
  role: "",
  plan: "",
  status: "",
  active: "",
  signedUp: "",
  from: "",
  to: "",
  sort: "active",
  dir: "desc",
  page: 1,
};

/**
 * Fields matched by the free-text search (case-insensitive substring).
 * Phase 2 adds "postalCode" here once the column exists.
 */
export const USER_SEARCH_FIELDS = ["name", "email"] as const;

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

function pick<T extends string>(allowed: readonly T[], v: string, fallback: T): T {
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(v: string): string {
  if (!DATE_RE.test(v)) return "";
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? "" : v;
}

export function parseUserListParams(raw: RawParams): UserListParams {
  const q = first(raw.q).slice(0, 120);
  const sort = pick(SORT_KEYS, first(raw.sort), DEFAULT_USER_LIST_PARAMS.sort);
  const dirRaw = first(raw.dir);
  const dir: SortDir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDir(sort);
  const pageNum = Number.parseInt(first(raw.page), 10);
  let signedUp = pick(SIGNED_UP_FILTERS, first(raw.signedUp), "");
  let from = validDate(first(raw.from));
  let to = validDate(first(raw.to));
  if (signedUp !== "custom") {
    from = "";
    to = "";
  } else if (!from && !to) {
    signedUp = "";
  }
  return {
    q,
    role: pick(ROLE_FILTERS, first(raw.role), ""),
    plan: pick(PLAN_FILTERS, first(raw.plan), ""),
    status: pick(STATUS_FILTERS, first(raw.status), ""),
    active: pick(ACTIVE_FILTERS, first(raw.active), ""),
    signedUp,
    from,
    to,
    sort,
    dir,
    page: Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 100000) : 1,
  };
}

export function defaultDir(sort: SortKey): SortDir {
  return sort === "name" || sort === "email" ? "asc" : "desc";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildUserWhere(
  p: UserListParams,
  now: Date = new Date()
): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (p.q) {
    and.push({
      OR: USER_SEARCH_FIELDS.map((field) => ({
        [field]: { contains: p.q, mode: "insensitive" as const },
      })),
    });
  }
  if (p.role) and.push({ role: p.role });
  if (p.plan) and.push({ plan: p.plan });
  if (p.status === "active") and.push({ disabled: false });
  if (p.status === "suspended") and.push({ disabled: true });

  if (p.active === "never") {
    and.push({ lastActiveAt: null });
  } else if (p.active) {
    const days = Number(p.active);
    and.push({ lastActiveAt: { gte: new Date(now.getTime() - days * DAY_MS) } });
  }

  if (p.signedUp === "custom") {
    const range: Prisma.DateTimeFilter = {};
    if (p.from) range.gte = new Date(`${p.from}T00:00:00.000Z`);
    if (p.to) range.lt = new Date(new Date(`${p.to}T00:00:00.000Z`).getTime() + DAY_MS);
    if (range.gte || range.lt) and.push({ createdAt: range });
  } else if (p.signedUp) {
    const days = Number(p.signedUp);
    and.push({ createdAt: { gte: new Date(now.getTime() - days * DAY_MS) } });
  }

  return and.length ? { AND: and } : {};
}

export function buildUserOrderBy(
  p: Pick<UserListParams, "sort" | "dir">
): Prisma.UserOrderByWithRelationInput[] {
  const dir = p.dir;
  const tie: Prisma.UserOrderByWithRelationInput = { id: dir };
  switch (p.sort) {
    case "active":
      return [{ lastActiveAt: { sort: dir, nulls: "last" } }, tie];
    case "name":
      return [{ name: { sort: dir, nulls: "last" } }, { email: dir }, tie];
    case "email":
      return [{ email: dir }, tie];
    case "recipes":
      return [{ ownedRecipes: { _count: dir } }, { createdAt: "desc" }, tie];
    case "created":
    default:
      return [{ createdAt: dir }, tie];
  }
}

export function pageWindow(total: number, page: number, pageSize = USER_LIST_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    pageCount,
    page: current,
    skip: (current - 1) * pageSize,
    take: pageSize,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(total, current * pageSize),
  };
}

/** Serialize params to a query string, omitting defaults. */
export function userListQuery(
  p: UserListParams,
  overrides: Partial<UserListParams> = {}
): string {
  const merged: UserListParams = { ...p, ...overrides };
  const sp = new URLSearchParams();
  if (merged.q) sp.set("q", merged.q);
  if (merged.role) sp.set("role", merged.role);
  if (merged.plan) sp.set("plan", merged.plan);
  if (merged.status) sp.set("status", merged.status);
  if (merged.active) sp.set("active", merged.active);
  if (merged.signedUp) sp.set("signedUp", merged.signedUp);
  if (merged.signedUp === "custom") {
    if (merged.from) sp.set("from", merged.from);
    if (merged.to) sp.set("to", merged.to);
  }
  if (merged.sort !== DEFAULT_USER_LIST_PARAMS.sort || merged.dir !== defaultDir(merged.sort)) {
    sp.set("sort", merged.sort);
    if (merged.dir !== defaultDir(merged.sort)) sp.set("dir", merged.dir);
  }
  if (merged.page > 1) sp.set("page", String(merged.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function userListHref(p: UserListParams, overrides: Partial<UserListParams> = {}): string {
  return `/admin/users${userListQuery(p, overrides)}`;
}

export const ACTIVE_LABELS: Record<ActiveFilter, string> = {
  "": "Any time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  never: "Never",
};

export const SIGNED_UP_LABELS: Record<SignedUpFilter, string> = {
  "": "Any time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  "365": "Last 12 months",
  custom: "Custom range",
};

export const SORT_LABELS: Record<SortKey, string> = {
  active: "Last active",
  created: "Signed up",
  name: "Name",
  email: "Email",
  recipes: "Recipes",
};

export type ActiveChip = { key: string; label: string; href: string };

/** Removable "Active filters" chips; each href clears that filter (and resets paging). */
export function activeFilterChips(p: UserListParams): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const base = { page: 1 };
  if (p.q) chips.push({ key: "q", label: `Search: “${p.q}”`, href: userListHref(p, { ...base, q: "" }) });
  if (p.role)
    chips.push({ key: "role", label: `Role: ${p.role === "admin" ? "Admin" : "User"}`, href: userListHref(p, { ...base, role: "" }) });
  if (p.plan)
    chips.push({ key: "plan", label: `Plan: ${p.plan === "pro" ? "Pro" : "Community"}`, href: userListHref(p, { ...base, plan: "" }) });
  if (p.status)
    chips.push({ key: "status", label: `Status: ${p.status === "active" ? "Active" : "Suspended"}`, href: userListHref(p, { ...base, status: "" }) });
  if (p.active)
    chips.push({
      key: "active",
      label: p.active === "never" ? "Last active: never" : `Last active: ${p.active} days`,
      href: userListHref(p, { ...base, active: "" }),
    });
  if (p.signedUp) {
    const label =
      p.signedUp === "custom"
        ? `Signed up: ${p.from || "…"} → ${p.to || "…"}`
        : `Signed up: ${SIGNED_UP_LABELS[p.signedUp].toLowerCase()}`;
    chips.push({ key: "signedUp", label, href: userListHref(p, { ...base, signedUp: "", from: "", to: "" }) });
  }
  return chips;
}
