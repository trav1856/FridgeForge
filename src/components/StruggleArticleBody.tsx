import { renderOriginStoryHtml } from "@/lib/origin-story-content";
import type { StruggleLink } from "@/lib/struggle-resources";

/** Safe paragraph + markdown-link rendering for Struggle detail articles. */
export function StruggleArticleBody({
  body,
  links,
}: {
  body: string;
  links?: StruggleLink[];
}) {
  const html = renderOriginStoryHtml(body || "");
  return (
    <div className="space-y-4">
      {html ? (
        <div
          className="prose-struggle space-y-3 text-sm leading-relaxed text-sage-800 [&_a]:font-semibold [&_a]:text-ember-700 [&_a]:underline [&_p]:mb-3"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-sm text-sage-600">No article yet.</p>
      )}
      {links && links.length > 0 && (
        <div className="rounded-xl border border-sage-200 bg-sage-50/70 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-sage-500">
            Useful links
          </p>
          <ul className="mt-2 space-y-1">
            {links.map((l) => (
              <li key={`${l.label}-${l.url}`}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-ember-700 underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
