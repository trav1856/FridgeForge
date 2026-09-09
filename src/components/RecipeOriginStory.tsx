"use client";

import { useState } from "react";

type Props = {
  title: string;
  originStory: string | null | undefined;
};

/** Expandable “Story behind this food” — hidden when empty. */
export function RecipeOriginStory({ title, originStory }: Props) {
  const story = (originStory || "").trim();
  const [open, setOpen] = useState(false);
  if (!story) return null;

  return (
    <section className="card overflow-hidden p-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-cream-50 sm:px-5"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-500">
            Learn more
          </p>
          <p className="font-display text-lg font-bold text-sage-900">
            Story behind this food
          </p>
          <p className="text-sm text-sage-600">
            A short look at where “{title}” comes from
          </p>
        </div>
        <span
          className={`text-sage-700 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-cream-200 px-4 py-4 text-sm leading-relaxed text-sage-800 sm:px-5">
          {story.split(/\n\n+/).map((para, i) => (
            <p key={i} className={i ? "mt-3" : undefined}>
              {para.trim()}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
