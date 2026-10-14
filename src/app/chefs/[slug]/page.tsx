/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { chefRecipes, getChef } from "@/lib/content/profiles";
import { livePosts } from "@/lib/content/posts";
import { currentViewer } from "@/lib/content/route-helpers";
import { canEditProfile } from "@/lib/content/permissions";
import { ChefAvatar } from "@/components/content/ChefAvatar";
import { ChefBadge } from "@/components/content/ChefBadge";
import { PostCard } from "@/components/content/PostCard";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
const EXT_REL = "noopener nofollow";

export async function generateMetadata({ params }: Props) {
  const c = await getChef((await params).slug);
  return { title: c ? `${c.name} · Chef's Corner` : "Chef's Corner" };
}

export default async function ChefPage({ params }: Props) {
  const { slug } = await params;
  const viewer = await currentViewer();
  const chef = await getChef(slug, viewer);
  if (!chef) notFound();
  const [recipes, posts] = await Promise.all([chefRecipes(chef.id), livePosts({ profileId: chef.id })]);
  const canEdit = canEditProfile(viewer, chef);
  return (
    <div className="space-y-8" data-testid="chef-page">
      <Link href="/chefs" className="text-sm font-semibold text-ember-700 hover:underline">← Chef&apos;s Corner</Link>
      <header className="card flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:items-start sm:p-8 sm:text-left">
        <ChefAvatar name={chef.name} photoUrl={chef.photoUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <ChefBadge />
          <h1 className="mt-2 font-display text-3xl font-bold text-sage-900 sm:text-4xl" data-testid="chef-name">{chef.name}</h1>
          {chef.hidden && <p className="mt-1 text-xs font-semibold text-red-700">Hidden from Chef&apos;s Corner</p>}
          {chef.credentials.length > 0 && (
            <ul className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start" data-testid="chef-credentials">
              {chef.credentials.map((c) => <li key={c} className="badge bg-sage-100 text-sage-800">{c}</li>)}
            </ul>
          )}
          {chef.bio && <p className="mt-3 whitespace-pre-line text-sage-700">{chef.bio}</p>}
          {(chef.links.length > 0 || chef.youtubeUrl) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start" data-testid="chef-links">
              {chef.youtubeUrl && (
                <a href={chef.youtubeUrl} target="_blank" rel={EXT_REL} className="btn-secondary px-3 py-1.5 text-sm">▶ YouTube</a>
              )}
              {chef.links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel={EXT_REL} className="btn-secondary px-3 py-1.5 text-sm">{l.label}</a>
              ))}
            </div>
          )}
          {canEdit && (
            <Link href={chef.userId && viewer?.id === chef.userId ? "/studio" : "/admin/chefs"} className="mt-4 inline-block text-sm font-semibold text-ember-700 hover:underline">
              Edit profile
            </Link>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-3 font-display text-2xl font-bold text-sage-900">Recipes</h2>
        {recipes.length === 0 ? (
          <p className="card p-5 text-sm text-sage-600">Recipes from {chef.name} will appear here.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="chef-recipes">
            {recipes.map((r) => (
              <Link key={r.id} href={`/recipes/${r.id}`} className="card group overflow-hidden transition hover:shadow-card-hover">
                <div className="aspect-[4/3] bg-cream-200">
                  {r.imageUrl ? <img src={r.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="p-4">
                  <ChefBadge />
                  <h3 className="mt-2 font-display text-lg font-bold text-sage-900 group-hover:text-ember-700">{r.title}</h3>
                  {r.cookTimeMinutes ? <p className="text-xs text-sage-500">{r.cookTimeMinutes} min</p> : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-2xl font-bold text-sage-900">Articles &amp; how-tos</h2>
        {posts.length === 0 ? (
          <p className="card p-5 text-sm text-sage-600">Nothing posted yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="chef-posts">
            {posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
