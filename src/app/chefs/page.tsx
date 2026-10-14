import Link from "next/link";
import type { Metadata } from "next";
import { allChefs, featuredChefs } from "@/lib/content/profiles";
import { livePosts } from "@/lib/content/posts";
import { ChefAvatar } from "@/components/content/ChefAvatar";
import { PostCard } from "@/components/content/PostCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chef's Corner · FridgeForge" };

export default async function ChefsPage() {
  const [top, everyone, posts] = await Promise.all([featuredChefs(3), allChefs(), livePosts({ take: 3 })]);
  return (
    <div className="space-y-10">
      <header className="overflow-hidden rounded-3xl border border-cream-300 bg-gradient-to-br from-amber-50 via-white to-ember-50 p-6 shadow-card sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">Chef&apos;s Corner</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold leading-tight text-sage-900 sm:text-5xl">
          Cooks worth learning from.
        </h1>
        <p className="mt-3 max-w-xl text-base text-sage-700">
          Recipes, techniques and stories from the chefs who cook with FridgeForge.
        </p>
      </header>

      <section aria-labelledby="featured-chefs" data-testid="featured-chefs">
        <h2 id="featured-chefs" className="mb-4 font-display text-2xl font-bold text-sage-900">Featured chefs</h2>
        {top.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 p-10 text-center" data-testid="chefs-empty-featured">
            <div className="text-4xl" aria-hidden>👩‍🍳</div>
            <p className="font-display text-xl font-bold text-sage-900">Featured chefs coming soon</p>
            <p className="max-w-md text-sm text-sage-600">We&apos;re lining up our first guest chefs. Check back for their recipes and kitchen stories.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {top.map((c) => (
              <Link key={c.id} href={`/chefs/${c.slug}`} className="card group flex flex-col items-center p-6 text-center transition hover:shadow-card-hover" data-testid="featured-chef-card">
                <ChefAvatar name={c.name} photoUrl={c.photoUrl} size="xl" />
                <h3 className="mt-4 font-display text-2xl font-bold text-sage-900 group-hover:text-ember-700">{c.name}</h3>
                {c.credentials[0] && <p className="mt-1 text-xs font-bold uppercase tracking-wider text-ember-700">{c.credentials[0]}</p>}
                {c.bio && <p className="mt-2 line-clamp-3 text-sm text-sage-600">{c.bio}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="all-chefs" data-testid="all-chefs">
        <h2 id="all-chefs" className="mb-4 font-display text-2xl font-bold text-sage-900">All chefs</h2>
        {everyone.length === 0 ? (
          <p className="card p-6 text-sm text-sage-600" data-testid="chefs-empty-all">Every chef who contributes will be listed here.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {everyone.map((c) => (
              <li key={c.id}>
                <Link href={`/chefs/${c.slug}`} className="card flex items-center gap-3 p-3 transition hover:shadow-card-hover" data-testid="chef-list-item">
                  <ChefAvatar name={c.name} photoUrl={c.photoUrl} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-sage-900">{c.name}</div>
                    <div className="text-xs text-sage-500">
                      {c._count.recipes} recipe{c._count.recipes === 1 ? "" : "s"} · {c._count.posts} post{c._count.posts === 1 ? "" : "s"}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="kt-latest">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="kt-latest" className="font-display text-2xl font-bold text-sage-900">From The Kitchen Table</h2>
          <Link href="/kitchen-table" className="text-sm font-semibold text-ember-700 hover:underline">All posts →</Link>
        </div>
        {posts.length === 0 ? (
          <p className="card p-6 text-sm text-sage-600">Stories, how-tos and news from our kitchen are on their way.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
