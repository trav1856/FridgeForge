import Link from "next/link";
import type { PinnedRecipeCard } from "@/lib/profile";

const PLACEHOLDER = "/recipe-images/placeholder.svg";

/** Recipe card for profile pins (server component). */
export function ProfileRecipeCard({
  recipe,
  badge,
}: {
  recipe: PinnedRecipeCard;
  badge: string;
}) {
  const meta = [
    recipe.cookTimeMinutes != null ? `${recipe.cookTimeMinutes} min` : null,
    recipe.servings ? `Serves ${recipe.servings}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="min-w-0 overflow-hidden rounded-2xl border border-cream-300/80 bg-white shadow-card transition hover:border-ember-200">
      <Link href={`/recipes/${recipe.id}`} className="block">
        <div className="relative aspect-[16/10] bg-cream-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipe.imageUrl || PLACEHOLDER}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-ember-700 shadow-sm">
            {badge}
          </span>
        </div>
        <div className="px-4 pb-4 pt-3">
          <h3 className="font-display text-[17px] font-bold leading-snug text-sage-900">
            {recipe.title}
          </h3>
          {meta && <p className="mt-1 text-xs text-sage-500">{meta}</p>}
        </div>
      </Link>
      {recipe.author && (
        <div className="-mt-2 flex items-center gap-2 px-4 pb-4 text-[13px] text-sage-600">
          <span
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sage-600 text-[11px] font-bold text-white"
          >
            {recipe.author.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 truncate">
            by{" "}
            {recipe.author.handle ? (
              <Link
                href={`/u/${recipe.author.handle}`}
                className="font-semibold text-sage-800 hover:text-ember-700 hover:underline"
              >
                {recipe.author.displayName}
              </Link>
            ) : (
              <span className="font-semibold text-sage-800">{recipe.author.displayName}</span>
            )}
          </span>
        </div>
      )}
    </li>
  );
}
