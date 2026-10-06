"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type AdminNavLink = { href: string; label: string; exact?: boolean };

export function AdminNav({ links }: { links: AdminNavLink[] }) {
  const pathname = usePathname() || "";
  return (
    <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5 text-sm" aria-label="Admin">
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border border-sage-200 bg-white text-sage-900 shadow-sm"
                : "border border-transparent text-sage-700 hover:bg-sage-100/70"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
