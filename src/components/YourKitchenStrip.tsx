import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getKitchenStripData } from "@/lib/public-profile";

/**
 * Signed-in only: compact homepage strip — latest How-to badges + pending
 * "Can I Have That?" count linking to Account recipe requests.
 */
export async function YourKitchenStrip() {
  noStore();
  const user = await getCurrentUser();
  if (!user) return null;

  const data = await getKitchenStripData(user.id);
  if (!data) return null;

  return (
    <section
      aria-label="Your kitchen"
      className="rounded-2xl border border-sage-200/80 bg-white/90 px-4 py-3 shadow-card sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sage-500">
            Your kitchen
          </p>
          <p className="truncate text-sm font-semibold text-sage-900">
            {data.displayName}
            {data.profileSlug ? (
              <Link
                href={`/u/${data.profileSlug}`}
                className="ml-2 text-xs font-medium text-ember-700 hover:underline"
              >
                @{data.profileSlug}
              </Link>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.latestBadges.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {data.latestBadges.map((b) => (
                <li
                  key={b.id}
                  className="inline-flex items-center gap-1 rounded-full bg-ember-50 px-2 py-0.5 text-xs font-medium text-ember-900 ring-1 ring-ember-100"
                  title={b.title}
                >
                  <span aria-hidden>{b.emoji}</span>
                  <span className="hidden sm:inline">{b.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Link
              href="/howto"
              className="text-xs font-medium text-sage-600 hover:text-ember-700 hover:underline"
            >
              Earn How-to badges
            </Link>
          )}
          <Link
            href="/account#recipe-requests"
            className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-2.5 py-1 text-xs font-bold text-sage-800 transition hover:bg-sage-200"
          >
            Can I Have That?
            {data.pendingRequestCount > 0 ? (
              <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                {data.pendingRequestCount > 99
                  ? "99+"
                  : data.pendingRequestCount}
              </span>
            ) : (
              <span className="font-semibold text-sage-500">0</span>
            )}
          </Link>
        </div>
      </div>
    </section>
  );
}
