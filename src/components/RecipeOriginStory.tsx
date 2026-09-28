"use client";

import { memo, useMemo, useState } from "react";
import {
  extractYoutubeEmbeds,
  renderOriginStoryHtml,
} from "@/lib/origin-story-content";
import {
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  type StoryMediaItem,
} from "@/lib/origin-story-media";

type Props = {
  title: string;
  originStory: string | null | undefined;
  media?: StoryMediaItem[] | null;
};

/** Thumbnail-to-play YouTube player: loads the iframe only after a click. */
export const StoryYoutube = memo(function StoryYoutube({
  videoId,
}: {
  videoId: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(videoId, true)}
            title="YouTube video"
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 h-full w-full"
            onClick={() => setPlaying(true)}
            aria-label="Play YouTube video"
            data-youtube-id={videoId}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={youtubeThumbnailUrl(videoId)}
              alt="YouTube video thumbnail"
              className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-20 items-center justify-center rounded-2xl bg-red-600 text-2xl text-white shadow-lg transition group-hover:scale-105">
                ▶
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="px-3 py-2 text-xs">
        <a
          href={youtubeWatchUrl(videoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ember-700 underline hover:text-ember-800"
        >
          Watch on YouTube
        </a>
      </div>
    </div>
  );
});

/**
 * “Story behind this food” — hidden when there is no text and no media.
 * Renders EXPANDED by default when it has content (SSR includes the body);
 * the header button still collapses/expands it.
 */
export function RecipeOriginStory({ title, originStory, media }: Props) {
  const story = (originStory || "").trim();
  const items = media ?? [];
  const hasContent = story.length > 0 || items.length > 0;
  const [open, setOpen] = useState(hasContent);
  const html = useMemo(
    () => (story ? renderOriginStoryHtml(story) : ""),
    [story]
  );
  const images = useMemo(
    () => items.filter((m) => m.kind === "image"),
    [items]
  );
  // Videos: explicit story media first, then links found in the story text (deduped).
  const videoIds = useMemo(() => {
    const ids: string[] = [];
    for (const m of items) {
      if (m.kind === "youtube" && !ids.includes(m.videoId)) ids.push(m.videoId);
    }
    if (story) {
      for (const e of extractYoutubeEmbeds(story)) {
        if (!ids.includes(e.id)) ids.push(e.id);
      }
    }
    return ids;
  }, [items, story]);
  if (!hasContent) return null;

  return (
    <section className="card overflow-hidden p-0" data-origin-story>
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
        <div
          className="border-t border-cream-200 px-4 py-4 text-sm leading-relaxed text-sage-800 sm:px-5"
          data-origin-story-body
        >
          {html && (
            <div
              className="origin-story-body [&_a]:text-ember-700 [&_a]:underline [&_a]:hover:text-ember-800 [&_p+p]:mt-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
          {images.length > 0 && (
            <div
              className={`grid gap-3 ${html ? "mt-4" : ""} ${images.length > 1 ? "sm:grid-cols-2" : ""}`}
            >
              {images.map((m) =>
                m.kind === "image" ? (
                  <a
                    key={m.id}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl border border-cream-200 bg-cream-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt={`Story photo for ${title}`}
                      className="h-auto max-h-[480px] w-full object-cover"
                      loading="lazy"
                      data-story-image
                    />
                  </a>
                ) : null
              )}
            </div>
          )}
          {videoIds.length > 0 && (
            <div className={`space-y-3 ${html || images.length ? "mt-4" : ""}`}>
              {videoIds.map((id) => (
                <StoryYoutube key={id} videoId={id} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
