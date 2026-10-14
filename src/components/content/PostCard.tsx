/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

export type PostCardData = {
  id: string;
  slug: string;
  kind: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  sponsorLabel: string | null;
  publishedAt: Date | string | null;
  profile?: { name: string; slug: string } | null;
};

export const KIND_LABEL: Record<string, string> = { article: "Article", howto: "How-to", announcement: "Announcement" };

export function fmtPostDate(d: Date | string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}

export function PostCard({ post }: { post: PostCardData }) {
  return (
    <Link href={`/kitchen-table/${post.slug}`} className="card group flex flex-col overflow-hidden transition hover:shadow-card-hover" data-testid="post-card">
      <div className="aspect-[16/9] w-full bg-gradient-to-br from-cream-200 to-ember-100">
        {post.coverUrl ? <img src={post.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ember-700">
          <span>{KIND_LABEL[post.kind] ?? "Article"}</span>
          {post.sponsorLabel && <span className="badge bg-sage-100 text-[10px] text-sage-700">{post.sponsorLabel}</span>}
        </div>
        <h3 className="mt-1 font-display text-lg font-bold leading-snug text-sage-900 group-hover:text-ember-700">{post.title}</h3>
        {post.excerpt && <p className="mt-1 line-clamp-3 text-sm text-sage-600">{post.excerpt}</p>}
        <p className="mt-auto pt-3 text-xs text-sage-500">
          {post.profile ? `${post.profile.name} · ` : ""}
          {fmtPostDate(post.publishedAt)}
        </p>
      </div>
    </Link>
  );
}
