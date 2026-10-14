/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { postForViewer } from "@/lib/content/posts";
import { currentViewer } from "@/lib/content/route-helpers";
import { canEditPost, isPostLive } from "@/lib/content/permissions";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { ChefAvatar } from "@/components/content/ChefAvatar";
import { KIND_LABEL, fmtPostDate } from "@/components/content/PostCard";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

const STATUS_COPY: Record<string, string> = {
  draft: "Draft preview. Only you and admins can see this.",
  review: "Waiting for review. Only you and admins can see this.",
  scheduled: "Scheduled. This preview is visible to you and admins until it goes live.",
};

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await currentViewer();
  const post = await postForViewer(slug, viewer);
  if (!post) notFound();
  const live = isPostLive(post);
  const related = post.relatedRecipeIds.length
    ? await prisma.recipe.findMany({ where: { id: { in: post.relatedRecipeIds }, visibility: { in: ["global", "public"] } }, select: { id: true, title: true, imageUrl: true } })
    : [];
  const author = post.profile && !post.profile.hidden ? post.profile : null;
  return (
    <article className="mx-auto max-w-3xl space-y-6" data-testid="post-page" data-live={live ? "1" : "0"}>
      {!live && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" data-testid="preview-banner">
          {STATUS_COPY[post.status] ?? STATUS_COPY.draft}
          {post.status === "scheduled" && post.publishedAt ? ` Goes live ${new Date(post.publishedAt).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT.` : ""}
        </div>
      )}
      <Link href="/kitchen-table" className="text-sm font-semibold text-ember-700 hover:underline">← The Kitchen Table</Link>
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-ember-700">
          <span>{KIND_LABEL[post.kind] ?? "Article"}</span>
          {post.sponsorLabel && <span className="badge bg-sage-100 text-sage-700" data-testid="sponsor-label">{post.sponsorLabel}</span>}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-sage-900 sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-3 text-lg text-sage-700">{post.excerpt}</p>}
        <div className="mt-4 flex items-center gap-3 text-sm text-sage-600">
          {author && (
            <Link href={`/chefs/${author.slug}`} className="flex items-center gap-2 font-semibold text-sage-900 hover:text-ember-700">
              <ChefAvatar name={author.name} photoUrl={author.photoUrl} size="sm" />
              {author.name}
            </Link>
          )}
          {live && <span>{fmtPostDate(post.publishedAt)}</span>}
          {canEditPost(viewer, post) && <Link href={`/studio/posts/${post.id}`} className="ml-auto font-semibold text-ember-700 hover:underline">Edit</Link>}
        </div>
      </header>
      {post.coverUrl && <img src={post.coverUrl} alt="" className="w-full rounded-3xl object-cover shadow-card" data-testid="post-cover" />}
      <div className="ff-prose" data-testid="post-body" dangerouslySetInnerHTML={{ __html: sanitizePostHtml(post.bodyHtml) }} />
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <Link key={t} href={`/kitchen-table?tag=${encodeURIComponent(t)}`} className="badge bg-sage-100 text-sage-800 hover:bg-sage-200">#{t}</Link>
          ))}
        </div>
      )}
      {related.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-xl font-bold text-sage-900">Related recipes</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/recipes/${r.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-cream-100">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream-200">
                    {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <span className="font-semibold text-sage-900">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
