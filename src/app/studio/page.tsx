import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentViewer } from "@/lib/content/route-helpers";
import { canAuthorPosts, isAdminViewer } from "@/lib/content/permissions";
import { myPosts } from "@/lib/content/posts";
import { serializeProfile } from "@/lib/content/profiles";
import { ProfileEditor } from "@/components/content/ProfileEditor";
import { NewPostButton } from "@/components/content/NewPostButton";
import { fmtPostDate, KIND_LABEL } from "@/components/content/PostCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chef studio · FridgeForge" };

const STATUS: Record<string, string> = { draft: "Draft", review: "In review", scheduled: "Scheduled", published: "Published" };

export default async function StudioPage() {
  const viewer = await currentViewer();
  if (!viewer) redirect("/account");
  if (!canAuthorPosts(viewer)) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-sage-900">Chef studio</h1>
        <p className="mt-2 text-sage-700">The studio is for chef accounts. Chefs share recipes, articles and how-tos in Chef&apos;s Corner.</p>
        <Link href="/chefs" className="btn-secondary mt-4 inline-block">Visit Chef&apos;s Corner</Link>
      </div>
    );
  }
  const [profileRow, posts] = await Promise.all([
    prisma.featuredProfile.findUnique({ where: { userId: viewer.id } }),
    myPosts(viewer),
  ]);
  const profile = profileRow ? serializeProfile(profileRow) : null;
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ember-700">Chef studio</p>
          <h1 className="font-display text-3xl font-bold text-sage-900">Your kitchen on FridgeForge</h1>
          {!isAdminViewer(viewer) && (
            <p className="mt-1 text-sm text-sage-600" data-testid="studio-publish-mode">
              {viewer.chefCanPublish ? "Your posts publish as soon as you hit Publish." : "Your posts are reviewed by an admin before they go live."}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {profile && <Link href={`/chefs/${profile.slug}`} className="btn-secondary">View my page</Link>}
          <Link href="/recipes/new" className="btn-secondary">New recipe</Link>
          <NewPostButton />
        </div>
      </header>

      <section className="card p-5">
        <h2 className="mb-3 font-display text-xl font-bold text-sage-900">My posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-sage-600">No posts yet. Start with a story behind one of your recipes.</p>
        ) : (
          <ul className="divide-y divide-cream-200" data-testid="studio-posts">
            {posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <Link href={`/studio/posts/${p.id}`} className="font-semibold text-sage-900 hover:text-ember-700">{p.title}</Link>
                <span className="text-xs text-sage-500">{KIND_LABEL[p.kind]}</span>
                <span className="badge ml-auto bg-sage-100 text-sage-800">{STATUS[p.effectiveStatus]}</span>
                {p.effectiveStatus === "published" && <span className="text-xs text-sage-500">{fmtPostDate(p.publishedAt)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile ? (
        <section className="card p-5">
          <h2 className="mb-1 font-display text-xl font-bold text-sage-900">My chef profile</h2>
          <p className="mb-4 text-sm text-sage-600">Shown in Chef&apos;s Corner. Your public recipes carry the Featured Chef badge.</p>
          <ProfileEditor initial={profile} endpoint="/api/content/profile" method="PATCH" />
        </section>
      ) : (
        isAdminViewer(viewer) && <p className="text-sm text-sage-600">Admins manage chef profiles in <Link className="font-semibold text-ember-700 hover:underline" href="/admin/chefs">Site ops → Chefs</Link>.</p>
      )}
    </div>
  );
}
