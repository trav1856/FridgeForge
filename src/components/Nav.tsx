"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStruggleMode } from "./StruggleModeProvider";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/pantry", label: "Pantry" },
  { href: "/recipes", label: "Recipes" },
  { href: "/suggestions", label: "Cook Now" },
  { href: "/coupons", label: "Coupons" },
  { href: "/account", label: "Account" },
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

  return (
    <header className="sticky top-0 z-40 border-b border-cream-300/70 bg-cream-50/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="FridgeForge"
            className="h-9 w-9 rounded-xl shadow-sm"
          />
          <div>
            <div className="font-display text-lg font-bold leading-tight text-sage-900 group-hover:text-ember-700">
              FridgeForge
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-sage-500">
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
            "rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
            struggleMode
              ? "bg-ember-600 text-white shadow-sm"
              : "bg-sage-100 text-sage-700 hover:bg-sage-200"
          )}
          title="Optimize for inexpensive staples and proud-plate energy"
        >
          {struggleMode ? "Struggle Meal ON" : "Struggle Meal"}
        </button>
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
