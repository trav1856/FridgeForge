"use client";

import { useState } from "react";
import { recipeIconsFrom } from "@/lib/recipe-icons";

type Props = {
  title?: string | null;
  tags?: string[] | null;
  ingredients?: { name: string }[] | string[] | null;
  description?: string | null;
  flavorBoosters?: string[] | null;
  className?: string;
};

/**
 * Cuisine/ingredient cue icons. Desktop: native title tooltip.
 * Mobile: tap an icon to reveal its meaning label (title alone is not enough).
 */
export function RecipeIcons(props: Props) {
  const icons = recipeIconsFrom(props);
  const [activeId, setActiveId] = useState<string | null>(null);
  if (icons.length === 0) return null;

  const active = icons.find((i) => i.id === activeId) ?? null;

  return (
    <div className={`space-y-1 ${props.className ?? ""}`.trim()}>
      <div
        className="flex flex-wrap items-center gap-1"
        aria-label="Recipe highlights"
      >
        {icons.map((icon) => {
          const selected = activeId === icon.id;
          return (
            <button
              key={icon.id}
              type="button"
              title={icon.label}
              aria-label={icon.label}
              aria-pressed={selected}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-base leading-none transition ${
                selected
                  ? "bg-ember-100 ring-1 ring-ember-300"
                  : "bg-cream-100 hover:bg-cream-200"
              }`}
              onClick={() =>
                setActiveId((cur) => (cur === icon.id ? null : icon.id))
              }
            >
              <span aria-hidden="true">{icon.emoji}</span>
            </button>
          );
        })}
      </div>
      {active && (
        <p
          className="text-[11px] leading-snug text-sage-700"
          data-testid="recipe-icon-label"
        >
          {active.emoji} {active.label}
        </p>
      )}
    </div>
  );
}
