import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { adminPosts } from "@/lib/content/posts";
import { NewPostButton } from "@/components/content/NewPostButton";
import { PinToggle } from "@/components/admin/PinToggle";
import { KIND_LABEL } from "@/components/content/PostCard";

export const dynamic = "force-dynamic";
const STATUS: Record<string, string> = { draft: "Draft", review: "In review", scheduled: "Scheduled", published: "Published" };
const fmt = (d: Date | null) => (d ? d.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " CT" : "");

export default async function AdminPostsPage() {
  await requireAdminPage();
  const [posts, pins] = await Promise.all([adminPosts(), prisma.featuredPin.findMany({ where: { kind: "post" }, select: { id: true, postId: true } })]);
  const pinned = new Map(pins.map((p) => [p.postId, p.id]));
  const queue = posts.filter((p) => p.status === "review");
  const row = (p: (typeof posts)[number]) => (
    <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5" data-testid="admin-post-row" data-id={p.id} data-status={p.effectiveStatus}>
      <Link href={`/studio/posts/${p.id}`} className="font-semibold text-sage-900 hover:text-ember-700">{p.title}</Link>
      <span className="text-xs text-sage-500">
        {KIND_LABEL[p.kind]} · {p.profile?.name ?? p.author?.name ?? "FridgeForge"}
        {p.sponsorLabel ? ` · ${p.sponsorLabel}` : ""}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className="badge bg-sage-100 text-sage-800">{STATUS[p.effectiveStatus]}</span>
        {p.status === "scheduled" && p.effectiveStatus !== "published" && <span className="text-xs text-sage-500">{fmt(p.publishedAt)}</span>}
        <Link href={`/kitchen-table/${p.slug}`} className="text-xs font-semibold text-ember-700 hover:underline">{p.effectiveStatus === "published" ? "View" : "Preview"}</Link>
        <PinToggle kind="post" refId={p.id} pinId={pinned.get(p.id) ?? null} />
      </span>
    </li>
  );
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-sage-900">The Kitchen Table</h2>
          <p className="text-xs text-sage-600">Articles, how-tos and announcements. Chef posts that need review land in the queue below.</p>
        </div>
        <NewPostButton />
      </div>
      <section className="card p-4" data-testid="review-queue">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-sage-600">Review queue ({queue.length})</h3>
        {queue.length === 0 ? <p className="mt-2 text-sm text-sage-500">Nothing waiting for review.</p> : <ul className="divide-y divide-cream-200">{queue.map(row)}</ul>}
      </section>
      <section className="card p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-sage-600">All posts ({posts.length})</h3>
        {posts.length === 0 ? <p className="mt-2 text-sm text-sage-500">No posts yet.</p> : <ul className="divide-y divide-cream-200">{posts.map(row)}</ul>}
      </section>
    </div>
  );
}
