"use client";

import { useState } from "react";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  /** taller hero on detail pages */
  variant?: "card" | "hero";
};

function initials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Gradient + initials when scrape/API image is missing or fails to load. */
export function RecipeImage({
  src,
  alt,
  className = "",
  variant = "card",
}: Props) {
  const [failed, setFailed] = useState(false);
  const height = variant === "hero" ? "h-48 sm:h-64" : "h-36";
  const showImg = Boolean(src) && !failed;

  if (!showImg) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-sage-800 via-sage-600 to-ember-600 ${height} ${className}`}
        aria-label={alt}
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,#f5f0e8,transparent_45%),radial-gradient(circle_at_80%_70%,#f5f0e8,transparent_40%)]" />
        <div className="relative flex h-full flex-col items-center justify-center gap-1 text-cream-50">
          <span className="font-display text-3xl font-bold tracking-wide opacity-95">
            {initials(alt)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] opacity-70">
            FridgeForge
          </span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!}
      alt={alt}
      className={`w-full object-cover ${height} rounded-xl bg-cream-100 ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
