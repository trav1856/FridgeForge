import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { adminPins } from "@/lib/content/pins";
import { isPostLive } from "@/lib/content/permissions";
import { PinRowActions } from "@/components/admin/PinRowActions";

export const dynamic = "force-dynamic";

export default async function AdminFeaturedPage() {
  await requireAdminPage();
  const pins = await adminPins();
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="font-display text-xl font-bold text-sage-900">Home &ldquo;Featured&rdquo; strip</h2>
        <p className="text-xs text-sage-600">
          Pin chefs from <Link href="/admin/chefs" className="font-semibold text-ember-700 hover:underline">Chefs</Link> and posts from{" "}
          <Link href="/admin/posts" className="font-semibold text-ember-700 hover:underline">Posts</Link>. The strip is hidden while nothing visible is pinned.
          Unpublished posts and hidden chefs stay pinned but don&apos;t show.
        </p>
      </div>
      <section className="card p-4" data-testid="pins">
        {pins.length === 0 ? (
          <p className="text-sm text-sage-500">Nothing pinned. The home page strip is hidden.</p>
        ) : (
          <ol className="divide-y divide-cream-200">
            {pins.map((p, i) => {
              const visible = p.kind === "profile" ? Boolean(p.profile && !p.profile.hidden) : Boolean(p.post && isPostLive(p.post));
              const label = p.kind === "profile" ? p.profile?.name : p.post?.title;
              const href = p.kind === "profile" ? `/chefs/${p.profile?.slug}` : `/kitchen-table/${p.post?.slug}`;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2.5" data-testid="pin-row">
                  <span className="w-6 text-sm font-bold text-sage-500">{i + 1}.</span>
                  <span className="badge bg-sage-100 text-sage-800">{p.kind === "profile" ? "Chef" : "Post"}</span>
                  <Link href={href} className="font-semibold text-sage-900 hover:text-ember-700">{label}</Link>
                  {!visible && <span className="text-xs text-amber-700">not visible yet</span>}
                  <PinRowActions pinId={p.id} first={i === 0} last={i === pins.length - 1} />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
