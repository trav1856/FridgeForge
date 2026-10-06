import Link from "next/link";
import clsx from "clsx";
import { requireAdminPage } from "@/lib/admin";
import {
  activeFilterChips,
  defaultDir,
  parseUserListParams,
  SORT_LABELS,
  userListHref,
  type SortKey,
  type UserListParams,
} from "@/lib/admin-user-query";
import { listAdminUsers } from "@/lib/admin-user-list";
import { getUserStats } from "@/lib/admin-user-stats";
import { avatarTone, fmtDate, fmtRelative, initials } from "@/lib/admin-format";
import { UserFilters } from "@/components/admin/UserFilters";
import { MiniBars } from "@/components/admin/MiniBars";
import { PlanBadge, RoleBadge, StatusBadge } from "@/components/admin/UserBadges";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function SortHeader({
  params,
  sort,
  label,
  className,
}: {
  params: UserListParams;
  sort: SortKey;
  label: string;
  className?: string;
}) {
  const active = params.sort === sort;
  const nextDir = active ? (params.dir === "asc" ? "desc" : "asc") : defaultDir(sort);
  return (
    <th className={className} aria-sort={active ? (params.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={userListHref(params, { sort, dir: nextDir, page: 1 })}
        scroll={false}
        className={clsx("hover:text-ember-700", active && "text-ember-700")}
      >
        {label}
        {active ? (params.dir === "asc" ? " ▴" : " ▾") : ""}
      </Link>
    </th>
  );
}

function pageList(page: number, pageCount: number): (number | "…")[] {
  const set = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const params = parseUserListParams(await searchParams);
  const now = new Date();
  const [list, stats] = await Promise.all([listAdminUsers(params, now), getUserStats(now)]);
  const chips = activeFilterChips(params);
  const thisWeek = stats.signupsByWeek[stats.signupsByWeek.length - 1]?.count ?? 0;
  const th = "px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-sage-600 whitespace-nowrap";

  return (
    <div className="ff-admin-wide space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-sage-900">Users</h2>
        <p className="hidden text-sm text-sage-600 sm:block">Search, filter and manage every FridgeForge account.</p>
      </div>

      <section className="card grid grid-cols-3 lg:grid-cols-[1.1fr_1.4fr_1.1fr_1.3fr]" aria-label="User stats">
        <div className="p-3 sm:px-5 sm:py-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-sage-600 sm:text-xs">Total users</h3>
          <div className="mt-1 font-display text-2xl font-bold text-sage-900 sm:text-3xl">{stats.total.toLocaleString("en-US")}</div>
          <div className="hidden text-xs font-semibold text-green-700 sm:block">+{stats.newLast30} in the last 30 days</div>
        </div>
        <div className="border-l border-cream-300 p-3 sm:px-5 sm:py-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-sage-600 sm:text-xs">New sign-ups / week</h3>
          <div className="flex items-end gap-3.5">
            <div className="mt-1 font-display text-2xl font-bold text-sage-900 sm:text-3xl">{thisWeek}</div>
            <MiniBars
              className="hidden flex-1 sm:flex"
              values={stats.signupsByWeek.map((w) => w.count)}
              labels={stats.signupsByWeek.map((w) => `Week of ${w.weekStart}`)}
            />
          </div>
          <div className="hidden text-xs text-sage-600 sm:block">This week · last 8 weeks (UTC, Mon–Sun)</div>
        </div>
        <div className="border-l border-cream-300 p-3 sm:px-5 sm:py-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-sage-600 sm:text-xs">Active users</h3>
          <div className="mt-1 font-display text-2xl font-bold text-sage-900 sm:text-3xl">{stats.active30.toLocaleString("en-US")}</div>
          <div className="hidden text-xs text-sage-600 sm:block">
            <b className="text-sage-900">{stats.active7}</b> in last 7 days · 30-day: {stats.active30}
          </div>
        </div>
        <div className="hidden border-l border-cream-300 px-5 py-4 lg:block">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sage-600">Top regions</h3>
          <p className="mt-2 text-sm text-sage-600">
            <span className="badge bg-ember-100 font-semibold text-ember-800">Coming in Phase 2</span>
          </p>
          <p className="mt-1 text-xs text-sage-500">Needs the optional postal code (not collected yet).</p>
        </div>
      </section>

      <section className="card p-4">
        <UserFilters params={params} />
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs text-sage-600">Active filters:</span>
            {chips.map((c) => (
              <Link
                key={c.key}
                href={c.href}
                scroll={false}
                className="inline-flex items-center gap-1.5 rounded-full bg-sage-800 py-0.5 pl-3 pr-1.5 text-xs font-semibold text-cream-50 hover:bg-sage-700"
                aria-label={`Remove filter ${c.label}`}
              >
                {c.label}
                <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20 text-[11px]" aria-hidden>
                  ×
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mx-0.5 flex flex-wrap items-center gap-2">
        <div className="text-xs text-sage-600">
          <b className="text-sage-900">
            {list.total} {list.total === 1 ? "user" : "users"}
          </b>{" "}
          match · sorted by <b className="text-sage-900">{SORT_LABELS[params.sort]}</b>
        </div>
        <div className="flex-1" />
        <span className="hidden text-[11px] text-sage-500 md:inline">
          Counts: recipes owned · cooks (all time, not undone) · pantry items in primary household
        </span>
      </div>

      {list.rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-sage-600">No users match these filters.</div>
      ) : (
        <>
          <section className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-sm" data-testid="users-table">
                <thead className="bg-cream-50">
                  <tr className="[&>th]:border-b [&>th]:border-cream-300">
                    <SortHeader params={params} sort="name" label="User" className={clsx(th, "w-[32%]")} />
                    <th className={th}>Role · plan</th>
                    <SortHeader params={params} sort="created" label="Signed up" className={th} />
                    <SortHeader params={params} sort="active" label="Last active" className={th} />
                    <SortHeader params={params} sort="recipes" label="Recipes" className={clsx(th, "text-right")} />
                    <th className={clsx(th, "text-right")}>Cooks</th>
                    <th className={clsx(th, "text-right")}>Pantry</th>
                    <th className={th}>Status</th>
                    <th className={th}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((u) => (
                    <tr key={u.id} className="hover:bg-cream-50 [&>td]:border-b [&>td]:border-cream-200" data-user-id={u.id}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={clsx("grid h-[34px] w-[34px] flex-none place-items-center rounded-full text-[13px] font-bold", avatarTone(u.id))}>
                            {initials(u.name, u.email)}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/admin/users/${u.id}`} className="font-semibold text-sage-900 hover:text-ember-700">
                              {u.name || u.email.split("@")[0]}
                            </Link>
                            <div className="truncate text-xs text-sage-600">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <RoleBadge role={u.role} />
                          <PlanBadge plan={u.plan} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-sage-600">{fmtDate(u.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-sage-900">{fmtRelative(u.lastActiveAt, now)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{u.recipes}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{u.cooks}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" title={u.primaryHousehold ?? "No household"}>
                        {u.pantry ?? <span className="font-normal text-sage-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge disabled={u.disabled} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="grid h-[30px] w-[30px] place-items-center rounded-[9px] border border-sage-200 bg-white text-sage-700 hover:bg-cream-100"
                          aria-label={`Open ${u.email}`}
                        >
                          ⋯
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager params={params} list={list} />
          </section>

          <div className="grid gap-2.5 md:hidden" data-testid="users-cards">
            {list.rows.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="card block px-3.5 py-3" data-user-id={u.id}>
                <div className="flex items-center gap-2.5">
                  <div className={clsx("grid h-[34px] w-[34px] flex-none place-items-center rounded-full text-[13px] font-bold", avatarTone(u.id))}>
                    {initials(u.name, u.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-sage-900">{u.name || u.email.split("@")[0]}</span>
                      {u.role === "admin" && <RoleBadge role="admin" />}
                      {u.disabled && <StatusBadge disabled />}
                    </div>
                    <div className="truncate text-xs text-sage-600">{u.email}</div>
                  </div>
                  <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] border border-sage-200 bg-white text-sage-700" aria-hidden>
                    ⋯
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3.5 text-xs text-sage-600">
                  <span>
                    <b className="text-sm text-sage-900">{u.recipes}</b> recipes
                  </span>
                  <span>
                    <b className="text-sm text-sage-900">{u.cooks}</b> cooks
                  </span>
                  <span>
                    <b className="text-sm text-sage-900">{u.pantry ?? "—"}</b> pantry
                  </span>
                  <span className="flex-1" />
                  <span>{fmtRelative(u.lastActiveAt, now)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-sage-600">
                  Joined {fmtDate(u.createdAt)} · <PlanBadge plan={u.plan} />
                </div>
              </Link>
            ))}
            <div className="card">
              <Pager params={params} list={list} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Pager({
  params,
  list,
}: {
  params: UserListParams;
  list: { total: number; page: number; pageCount: number; from: number; to: number };
}) {
  const btn =
    "grid h-[30px] min-w-[30px] place-items-center rounded-[9px] border border-sage-200 bg-white px-2 text-sm font-semibold text-sage-800 hover:bg-cream-100";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-sage-600">
      <span>
        Showing {list.from}–{list.to} of {list.total}
      </span>
      {list.pageCount > 1 && (
        <nav className="flex gap-1" aria-label="Pagination">
          {list.page > 1 && (
            <Link className={btn} href={userListHref(params, { page: list.page - 1 })} scroll={false}>
              ← Prev
            </Link>
          )}
          {pageList(list.page, list.pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="grid h-[30px] min-w-[30px] place-items-center">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={userListHref(params, { page: p })}
                scroll={false}
                aria-current={p === list.page ? "page" : undefined}
                className={clsx(btn, p === list.page && "border-sage-800 bg-sage-800 text-cream-50 hover:bg-sage-800")}
              >
                {p}
              </Link>
            )
          )}
          {list.page < list.pageCount && (
            <Link className={btn} href={userListHref(params, { page: list.page + 1 })} scroll={false}>
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
