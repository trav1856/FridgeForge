"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStruggleMode } from "./StruggleModeProvider";
import clsx from "clsx";

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.user?.plan === "pro") setPlanLabel("Pro");
        else if (data?.user) setPlanLabel("Community");
        else setPlanLabel(null);
      })
      .catch(() => {
        if (!cancelled) setPlanLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const accountActive = pathname.startsWith("/account");

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

        <Link
          href="/account"
          className={clsx(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
            accountActive
              ? "bg-sage-800 text-cream-50 shadow-sm"
              : "bg-sage-100 text-sage-700 hover:bg-sage-200"
          )}
        >
          Account
        </Link>
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
