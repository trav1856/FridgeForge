/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { homePins } from "@/lib/content/pins";
import { ChefAvatar } from "./ChefAvatar";
import { KIND_LABEL } from "./PostCard";

/** Admin-pinned chefs/posts. Renders nothing when nothing visible is pinned. */
export async function FeaturedStrip() {
  const items = await homePins().catch(() => []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="home-featured" data-testid="home-featured">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="home-featured" className="font-display text-2xl font-bold text-sage-900">Featured</h2>
        <Link href="/chefs" className="text-sm font-semibold text-ember-700 hover:underline">Chef&apos;s Corner →</Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
        {items.map((it) => (
          <li key={it.pinId} className="w-[260px] shrink-0 snap-start sm:w-[300px]" data-testid="featured-item" data-kind={it.kind}>
            {it.kind === "profile" ? (
              <Link href={`/chefs/${it.slug}`} className="card group flex h-full flex-col items-center p-5 text-center transition hover:shadow-card-hover">
                <ChefAvatar name={it.name} photoUrl={it.photoUrl} size="lg" />
                <span className="mt-3 text-[11px] font-bold uppercase tracking-wider text-ember-700">Featured chef</span>
                <span className="font-display text-xl font-bold text-sage-900 group-hover:text-ember-700">{it.name}</span>
                {it.bio && <span className="mt-1 line-clamp-2 text-sm text-sage-600">{it.bio}</span>}
              </Link>
            ) : (
              <Link href={`/kitchen-table/${it.slug}`} className="card group flex h-full flex-col overflow-hidden transition hover:shadow-card-hover">
                <div className="aspect-[16/9] bg-gradient-to-br from-cream-200 to-ember-100">
                  {it.coverUrl ? <img src={it.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ember-700">
                    {KIND_LABEL[it.postKind] ?? "Article"}
                    {it.sponsorLabel ? ` · ${it.sponsorLabel}` : ""}
                  </span>
                  <span className="mt-1 block font-display text-lg font-bold leading-snug text-sage-900 group-hover:text-ember-700">{it.title}</span>
                  {it.excerpt && <span className="mt-1 line-clamp-2 block text-sm text-sage-600">{it.excerpt}</span>}
                </div>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
