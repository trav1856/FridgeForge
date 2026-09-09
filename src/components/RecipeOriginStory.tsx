"use client";

import { useMemo, useState } from "react";
import {
  extractYoutubeEmbeds,
  renderOriginStoryHtml,
} from "@/lib/origin-story-content";

type Props = {
  title: string;
  originStory: string | null | undefined;
};

/** Expandable “Story behind this food” — hidden when empty. */
export function RecipeOriginStory({ title, originStory }: Props) {
  const story = (originStory || "").trim();
  const [open, setOpen] = useState(false);
  const html = useMemo(
    () => (story ? renderOriginStoryHtml(story) : ""),
    [story]
  );
  const embeds = useMemo(
    () => (story ? extractYoutubeEmbeds(story) : []),
    [story]
  );
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
          <div
            className="origin-story-body [&_a]:text-ember-700 [&_a]:underline [&_a]:hover:text-ember-800 [&_p+p]:mt-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {embeds.length > 0 && (
            <div className="mt-4 space-y-3">
              {embeds.map((yt) => (
                <div
                  key={yt.id}
                  className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50"
                >
                  <div className="relative aspect-video w-full">
                    <iframe
                      src={yt.embedUrl}
                      title="YouTube video"
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
