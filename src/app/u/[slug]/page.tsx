import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getActiveHouseholdId, getCurrentUser } from "@/lib/auth";
import { BadgeChip } from "@/components/BadgeChip";
import { RecipeCardRating } from "@/components/RecipeCardRating";
import { ProfileRecipeCard } from "@/components/profile/ProfileRecipeCard";
import { getProfilePageData } from "@/lib/profile";
import { initialsFor } from "@/lib/profile-fields";
import { visibilityLabel } from "@/lib/recipe-visibility";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const EXT_REL = "noopener noreferrer nofollow";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.8-6.3L6.4 22H3.3l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.5c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.4V14h2.7v8h3.4Z" />
    </svg>
  );
}

export default async function PublicProfilePage({ params }: Props) {
  noStore();
  const { slug } = await params;
  const viewerUser = await getCurrentUser();
  const data = await getProfilePageData(slug, {
    userId: viewerUser?.id ?? null,
    userEmail: viewerUser?.email ?? null,
    householdId: getActiveHouseholdId(viewerUser),
  });
  if (!data) notFound();

  if (data.kind === "private") {
    return (
      <div className="mx-auto max-w-md py-10" data-testid="profile-private">
        <div className="card p-8 text-center">
          <div aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-sage-100 text-2xl">
            🔒
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-sage-900">
            This profile is private
          </h1>
          <p className="mt-1 text-sm text-sage-600">@{data.handle}</p>
        </div>
      </div>
    );
  }

  const { profile, isOwner } = data;
  const showOwn = data.ownPins.length > 0 || isOwner;
  const showFav = data.favoritePins.length > 0 || isOwner;

  return (
    <div className="pb-6" data-testid="profile-page">
      {/* Banner + overlapping avatar */}
      <div
        className="relative -mx-4 -mt-6 h-36 overflow-hidden bg-gradient-to-br from-ember-200 via-cream-200 to-sage-200 sm:mx-0 sm:mt-0 sm:h-52 sm:rounded-3xl lg:h-60"
        data-testid="profile-banner"
      >
        {profile.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-sage-900/25" />
      </div>

      <div className="relative z-10 -mt-12 flex flex-wrap items-end gap-x-5 gap-y-3 px-1 sm:-mt-16 sm:px-6">
        <div
          className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-cream-50 bg-gradient-to-br from-ember-300 to-ember-700 font-display text-3xl font-bold text-white shadow-lg sm:h-32 sm:w-32 sm:text-4xl"
          data-testid="profile-avatar"
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={`${profile.displayName}'s profile picture`} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>{initialsFor(profile.displayName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 basis-full pb-1 sm:basis-auto">
          <h1 className="break-words font-display text-2xl font-bold text-sage-900 sm:text-3xl">
            {profile.displayName}
          </h1>
          <p className="text-sm text-sage-500">@{profile.handle}</p>
        </div>
        <div className="flex items-center gap-2 pb-2">
          {profile.socialX && (
            <a
              href={profile.socialX}
              target="_blank"
              rel={EXT_REL}
              aria-label="X profile"
              className="grid h-9 w-9 place-items-center rounded-full border border-cream-300 bg-white text-sage-700 transition hover:border-ember-200 hover:text-ember-700"
            >
              <XIcon />
            </a>
          )}
          {profile.socialFacebook && (
            <a
              href={profile.socialFacebook}
              target="_blank"
              rel={EXT_REL}
              aria-label="Facebook page"
              className="grid h-9 w-9 place-items-center rounded-full border border-cream-300 bg-white text-sage-700 transition hover:border-ember-200 hover:text-ember-700"
            >
              <FacebookIcon />
            </a>
          )}
          {isOwner && (
            <Link href="/account/profile" className="btn-secondary text-sm" data-testid="profile-edit-link">
              Edit profile
            </Link>
          )}
        </div>
      </div>

      {isOwner && (
        <div
          className="mt-5 rounded-2xl border border-ember-100 bg-ember-50 px-4 py-2.5 text-sm text-ember-800"
          data-testid="profile-owner-bar"
        >
          {data.isPrivate
            ? "🔒 Your profile is private. Only you can see this page; others see “This profile is private”."
            : "This is your public profile. Anyone can see it."}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="min-w-0 space-y-5">
          {(profile.bio || isOwner) && (
            <section className="card p-5" data-testid="profile-about">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">About</h2>
              {profile.bio ? (
                <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-sage-700">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-3 text-sm text-sage-500">
                  Add a short bio in{" "}
                  <Link href="/account/profile" className="font-semibold text-ember-700 hover:underline">
                    Edit profile
                  </Link>
                  .
                </p>
              )}
            </section>
          )}
          <section className="card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">How-to badges</h2>
            {data.badges.length === 0 ? (
              <p className="mt-3 text-sm text-sage-500">No badges earned yet.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {data.badges.map((b) => (
                  <BadgeChip key={b.id} badge={b} compact />
                ))}
              </ul>
            )}
          </section>
          {isOwner && (
            <section className="rounded-2xl border border-sage-200 bg-sage-50 p-5 text-sm leading-relaxed text-sage-700">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-sage-500">Only you see this</h2>
              <p className="mt-2">
                Your allergies, diet preferences, pantry and email are never shown on your profile.
              </p>
            </section>
          )}
        </aside>

        <div className="min-w-0 space-y-10">
          {showOwn && (
            <section data-testid="profile-top3">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-sage-900 sm:text-2xl">My top 3 recipes</h2>
              </div>
              {data.ownPins.length ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.ownPins.map((r) => (
                    <ProfileRecipeCard key={r.id} recipe={r} badge="📌 Pinned" />
                  ))}
                </ul>
              ) : (
                <p className="card p-5 text-sm text-sage-600">
                  Pin up to 3 of your own recipes in{" "}
                  <Link href="/account/profile" className="font-semibold text-ember-700 hover:underline">
                    Edit profile
                  </Link>
                  .
                </p>
              )}
            </section>
          )}

          {showFav && (
            <section data-testid="profile-favorites">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-sage-900 sm:text-2xl">
                  Favorites from other cooks
                </h2>
              </div>
              {data.favoritePins.length ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.favoritePins.map((r) => (
                    <ProfileRecipeCard key={r.id} recipe={r} badge="♥ Favorite" />
                  ))}
                </ul>
              ) : (
                <p className="card p-5 text-sm text-sage-600">
                  Pin up to 3 recipes you&apos;ve favorited from other cooks in{" "}
                  <Link href="/account/profile" className="font-semibold text-ember-700 hover:underline">
                    Edit profile
                  </Link>
                  .
                </p>
              )}
            </section>
          )}

          <section data-testid="profile-recipes">
            <h2 className="mb-3 font-display text-xl font-bold text-sage-900 sm:text-2xl">Recipes</h2>
            {data.recipes.length === 0 ? (
              <p className="card p-5 text-sm text-sage-600">No household or public recipes to show.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.recipes.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/recipes/${r.id}`}
                      className="block h-full overflow-hidden rounded-2xl border border-cream-300 bg-white/90 transition hover:border-ember-200 hover:shadow-card"
                    >
                      <div className="relative aspect-[16/10] bg-cream-100" data-testid="profile-recipe-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.imageUrl || "/recipe-images/placeholder.svg"}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="px-4 pb-3 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-sage-900">{r.title}</span>
                        <span className="badge bg-sage-100 text-sage-700">{visibilityLabel(r.visibility)}</span>
                      </div>
                      {r.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-sage-600">{r.description}</p>
                      )}
                      <RecipeCardRating averageStars={r.averageStars} reviewCount={r.reviewCount} className="mt-1" />
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-sage-500">
                        {r.isStruggleMeal && <span>Struggle meal</span>}
                        {r.cookTimeMinutes != null && <span>{r.cookTimeMinutes} min</span>}
                        <span className="capitalize">{r.costTier}</span>
                      </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
