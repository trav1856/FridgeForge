"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ACTIVE_FILTERS,
  ACTIVE_LABELS,
  DEFAULT_USER_LIST_PARAMS,
  SIGNED_UP_FILTERS,
  SIGNED_UP_LABELS,
  SORT_KEYS,
  SORT_LABELS,
  defaultDir,
  userListHref,
  type UserListParams,
} from "@/lib/admin-user-query";

const selectCls = "select";

export function UserFilters({ params }: { params: UserListParams }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.q);
  const [more, setMore] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync when the URL changes elsewhere (chip removal, reset).
  useEffect(() => {
    setQ((cur) => (cur.trim() === params.q ? cur : params.q));
  }, [params.q]);

  function go(overrides: Partial<UserListParams>) {
    const href = userListHref(params, { page: 1, ...overrides });
    startTransition(() => router.replace(href, { scroll: false }));
  }

  function onSearch(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ q: v.trim() }), 350);
  }

  const hiddenCount = [params.signedUp, params.active, params.status].filter(Boolean).length;

  return (
    <div className={clsx("transition-opacity", pending && "opacity-70")} aria-busy={pending}>
      <div className="grid grid-cols-2 items-end gap-2.5 lg:grid-cols-[2.2fr_repeat(5,minmax(0,1fr))_auto]">
        <div className="col-span-2 lg:col-span-1">
          <label className="label" htmlFor="uf-q">
            Search
          </label>
          <div className="relative">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#728063"
              strokeWidth="2.4"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="uf-q"
              type="search"
              className="input pl-9"
              placeholder="Name or email"
              value={q}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (timer.current) clearTimeout(timer.current);
                  go({ q: q.trim() });
                }
              }}
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="uf-role">
            Role
          </label>
          <select
            id="uf-role"
            className={selectCls}
            value={params.role}
            onChange={(e) => go({ role: e.target.value as UserListParams["role"] })}
          >
            <option value="">Any role</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="uf-plan">
            Plan
          </label>
          <select
            id="uf-plan"
            className={selectCls}
            value={params.plan}
            onChange={(e) => go({ plan: e.target.value as UserListParams["plan"] })}
          >
            <option value="">Any plan</option>
            <option value="free">Free</option>
            <option value="pro">Premium</option>
          </select>
        </div>
        <div className={clsx(!more && "hidden", "lg:block")}>
          <label className="label" htmlFor="uf-signed">
            Signed up
          </label>
          <select
            id="uf-signed"
            className={selectCls}
            value={params.signedUp}
            onChange={(e) => {
              const v = e.target.value as UserListParams["signedUp"];
              if (v === "custom") {
                const today = new Date().toISOString().slice(0, 10);
                go({ signedUp: v, from: params.from || "", to: params.to || today });
              } else go({ signedUp: v, from: "", to: "" });
            }}
          >
            {SIGNED_UP_FILTERS.map((k) => (
              <option key={k || "any"} value={k}>
                {SIGNED_UP_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className={clsx(!more && "hidden", "lg:block")}>
          <label className="label" htmlFor="uf-active">
            Last active
          </label>
          <select
            id="uf-active"
            className={selectCls}
            value={params.active}
            onChange={(e) => go({ active: e.target.value as UserListParams["active"] })}
          >
            {ACTIVE_FILTERS.map((k) => (
              <option key={k || "any"} value={k}>
                {ACTIVE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className={clsx(!more && "hidden", "lg:block")}>
          <label className="label" htmlFor="uf-status">
            Status
          </label>
          <select
            id="uf-status"
            className={selectCls}
            value={params.status}
            onChange={(e) => go({ status: e.target.value as UserListParams["status"] })}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className={clsx(!more && "hidden", "lg:hidden")}>
          <label className="label" htmlFor="uf-sort">
            Sort
          </label>
          <select
            id="uf-sort"
            className={selectCls}
            value={params.sort}
            onChange={(e) => {
              const sort = e.target.value as UserListParams["sort"];
              go({ sort, dir: defaultDir(sort) });
            }}
          >
            {SORT_KEYS.map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden lg:block">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setQ("");
              startTransition(() =>
                router.replace(userListHref(DEFAULT_USER_LIST_PARAMS), { scroll: false })
              );
            }}
          >
            Reset
          </button>
        </div>
        <div className="col-span-2 lg:hidden">
          <button type="button" className="btn-secondary w-full" onClick={() => setMore((m) => !m)} aria-expanded={more}>
            {more ? "Fewer filters" : `More filters${hiddenCount ? ` · ${hiddenCount}` : ""}`}
          </button>
        </div>
      </div>
      {params.signedUp === "custom" && (
        <div className="mt-3 flex flex-wrap items-end gap-2.5">
          <div>
            <label className="label" htmlFor="uf-from">
              Signed up from
            </label>
            <input
              id="uf-from"
              type="date"
              className="input"
              value={params.from}
              onChange={(e) => go({ from: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="uf-to">
              To
            </label>
            <input
              id="uf-to"
              type="date"
              className="input"
              value={params.to}
              onChange={(e) => go({ to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
