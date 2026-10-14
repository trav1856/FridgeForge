import Link from "next/link";
import type { Metadata } from "next";
import { livePosts } from "@/lib/content/posts";
import { currentViewer } from "@/lib/content/route-helpers";
import { canAuthorPosts } from "@/lib/content/permissions";
import { PostCard } from "@/components/content/PostCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The Kitchen Table · FridgeForge" };

export default async function KitchenTablePage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag } = await searchParams;
  const cleanTag = typeof tag === "string" ? tag.slice(0, 40).toLowerCase() : null;
  const [posts, viewer] = await Promise.all([livePosts({ tag: cleanTag }), currentViewer()]);
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">The Kitchen Table</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-sage-900">Stories, how-tos &amp; news</h1>
          <p className="mt-2 max-w-xl text-sage-700">Pull up a chair. Kitchen notes from FridgeForge and the chefs in Chef&apos;s Corner.</p>
        </div>
        {canAuthorPosts(viewer) && <Link href="/studio" className="btn-secondary">Write a post</Link>}
      </header>
      {cleanTag && (
        <p className="text-sm text-sage-700">
          Tagged <span className="badge bg-sage-100 text-sage-800">#{cleanTag}</span>{" "}
          <Link href="/kitchen-table" className="font-semibold text-ember-700 hover:underline">Clear</Link>
        </p>
      )}
      {posts.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center" data-testid="kt-empty">
          <div className="text-4xl" aria-hidden>🍽️</div>
          <p className="font-display text-xl font-bold text-sage-900">{cleanTag ? "No posts with that tag yet" : "The first stories are on their way"}</p>
          <p className="max-w-md text-sm text-sage-600">Recipes behind the recipes, technique how-tos and kitchen news will show up here.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="kt-list">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
