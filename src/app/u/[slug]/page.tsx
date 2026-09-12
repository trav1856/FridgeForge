import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import {
  getActiveHouseholdId,
  getCurrentUser,
} from "@/lib/auth";
import { getPublicProfileBySlug } from "@/lib/public-profile";
import { visibilityLabel } from "@/lib/recipe-visibility";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function PublicProfilePage({ params }: Props) {
  noStore();
  const { slug } = await params;
  const viewerUser = await getCurrentUser();
  const viewer = {
    userId: viewerUser?.id ?? null,
    userEmail: viewerUser?.email ?? null,
    householdId: getActiveHouseholdId(viewerUser),
  };

  const profile = await getPublicProfileBySlug(slug, viewer);
  if (!profile) notFound();

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-cream-300 bg-gradient-to-br from-cream-50 via-white to-sage-50 p-6 shadow-card sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sage-500">
          Public profile
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-sage-900 sm:text-4xl">
          {profile.displayName}
        </h1>
        <p className="mt-1 text-sm text-sage-600">@{profile.profileSlug}</p>
        {viewerUser?.id === profile.id && (
          <p className="mt-3 text-sm text-sage-600">
            This is how others see you.{" "}
            <Link
              href="/account"
              className="font-semibold text-ember-700 hover:underline"
            >
              Edit on Account
            </Link>
          </p>
        )}
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-sage-900">
            How-to badges
          </h2>
          <Link
            href="/howto"
            className="text-xs font-semibold uppercase tracking-wide text-ember-700 hover:underline"
          >
            How-to
          </Link>
        </div>
        {profile.badges.length === 0 ? (
          <p className="text-sm text-sage-600">No badges earned yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {profile.badges.map((b) => (
              <li
                key={b.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-ember-50 px-3 py-1.5 text-sm font-medium text-ember-900 ring-1 ring-ember-200"
                title={b.description ?? undefined}
              >
                <span aria-hidden>{b.emoji}</span>
                {b.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-sage-900">
          Shared recipes
        </h2>
        {profile.recipes.length === 0 ? (
          <p className="text-sm text-sage-600">
            No household or public recipes to show.
          </p>
        ) : (
          <ul className="space-y-2">
            {profile.recipes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="block rounded-2xl border border-cream-300 bg-cream-50/60 px-4 py-3 transition hover:border-ember-200 hover:shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-sage-900">{r.title}</span>
                    <span className="badge bg-sage-100 text-sage-700">
                      {visibilityLabel(r.visibility)}
                    </span>
                  </div>
                  {r.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-sage-600">
                      {r.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-sage-500">
                    {r.isStruggleMeal && <span>Struggle meal</span>}
                    {r.cookTimeMinutes != null && (
                      <span>{r.cookTimeMinutes} min</span>
                    )}
                    <span className="capitalize">{r.costTier}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
