"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useStruggleMode } from "./StruggleModeProvider";
import clsx from "clsx";
import { RECIPE_REQUESTS_CHANGED_EVENT } from "@/lib/recipe-request";

const links = [
  { href: "/", label: "Home" },
  { href: "/pantry", label: "Pantry" },
  { href: "/shopping-list", label: "List" },
  { href: "/recipes", label: "Recipes" },
  { href: "/suggestions", label: "Cook Now" },
  { href: "/coupons", label: "Coupons" },
];

export function Nav() {
  const pathname = usePathname();
  const { struggleMode, toggle } = useStruggleMode();
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    fetch("/api/recipe-requests?box=pending-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const n =
          typeof data?.pendingCount === "number" ? data.pendingCount : 0;
        setPendingRequestCount(n);
      })
      .catch(() => setPendingRequestCount(0));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.user?.plan === "pro") setPlanLabel("Pro");
        else if (data?.user) setPlanLabel("Community");
        else setPlanLabel(null);
        setIsAdminUser(data?.user?.role === "admin");
        if (data?.user) {
          refreshPendingCount();
        } else {
          setPendingRequestCount(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlanLabel(null);
          setIsAdminUser(false);
          setPendingRequestCount(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, refreshPendingCount]);

  useEffect(() => {
    const onChange = () => refreshPendingCount();
    window.addEventListener(RECIPE_REQUESTS_CHANGED_EVENT, onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(RECIPE_REQUESTS_CHANGED_EVENT, onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refreshPendingCount]);

  const accountActive = pathname.startsWith("/account");
  const adminActive = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 border-b border-cream-300/70 bg-cream-50/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/" className="group flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="FridgeForge"
              className="h-9 w-9 shrink-0 rounded-xl shadow-sm"
            />
            <div className="min-w-0">
              <div className="font-display text-lg font-bold leading-tight text-sage-900 group-hover:text-ember-700">
                FridgeForge
              </div>
              <div className="truncate text-[10px] font-medium uppercase tracking-wider text-sage-500">
                {planLabel
                  ? `${planLabel} · signed in`
                  : "Community Edition · stable"}
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={toggle}
            className={clsx(
              "shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition sm:px-3 sm:text-xs",
              struggleMode
                ? "bg-ember-600 text-white shadow-sm"
                : "bg-sage-100 text-sage-700 hover:bg-sage-200"
            )}
            title="Struggle Meal Mode: prioritize cheap staples and budget-friendly suggestions"
          >
            {struggleMode ? "Struggle Meal Mode ON" : "Struggle Meal Mode"}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isAdminUser && (
            <Link
              href="/admin"
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
                adminActive
                  ? "bg-ember-600 text-white shadow-sm"
                  : "bg-ember-50 text-ember-800 hover:bg-ember-100"
              )}
            >
              Admin
            </Link>
          )}
          <Link
            href="/account"
            className={clsx(
              "relative rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
              accountActive
                ? "bg-sage-800 text-cream-50 shadow-sm"
                : "bg-sage-100 text-sage-700 hover:bg-sage-200"
            )}
            aria-label={
              pendingRequestCount > 0
                ? `Account, ${pendingRequestCount} pending recipe request${
                    pendingRequestCount === 1 ? "" : "s"
                  }`
                : "Account"
            }
          >
            Account
            {pendingRequestCount > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-cream-50"
                aria-hidden
              >
                {pendingRequestCount > 99 ? "99+" : pendingRequestCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
        {links.map((l) => {
          const active =
            l.href === "/"
              ? pathname === "/"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-sage-800 text-cream-50"
                  : "text-sage-700 hover:bg-sage-100"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
