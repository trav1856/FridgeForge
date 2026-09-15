"use client";

import type { AdaptHint } from "@/lib/dietary";

type Props = {
  hint: AdaptHint | null | undefined;
  /** Compact one-liner for cards; default is prominent detail callout. */
  compact?: boolean;
  className?: string;
};

/** Prominent “Make it vegan/vegetarian/kosher: …” when recipe isn’t eligible but has a note. */
export function DietaryAdaptNote({
  hint,
  compact = false,
  className = "",
}: Props) {
  if (!hint?.note) return null;
  if (compact) {
    return (
      <p
        className={`text-[11px] leading-snug text-lime-800 ${className}`.trim()}
        data-testid={`adapt-note-${hint.kind}`}
      >
        <span className="font-semibold">{hint.label}:</span> {hint.note}
      </p>
    );
  }
  return (
    <div
      className={`rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-950 ${className}`.trim()}
      data-testid={`adapt-note-${hint.kind}`}
      role="note"
    >
      <div className="font-semibold">{hint.label}</div>
      <p className="mt-0.5 text-lime-900">{hint.note}</p>
    </div>
  );
}
