import Link from "next/link";
import { RecipeImage } from "./RecipeImage";
import { RecipeCardRating } from "./RecipeCardRating";
import type { DishVariantRole } from "@/lib/dish-variant-picks";

export type VariantCard = {
  id: string;
  title: string;
  imageUrl: string | null;
  averageStars?: number | null;
  reviewCount?: number;
};

export type FeaturedVariantCard = {
  role: DishVariantRole;
  label: string;
  recipe: VariantCard;
};

type Props = {
  /** Featured trio: Top rated / Oldest / Surprise */
  featured?: FeaturedVariantCard[];
  /** Remaining variants for the dish family (below the band) */
  rest?: VariantCard[];
  /** @deprecated prefer featured + rest; flat list treated as rest only */
  variants?: VariantCard[];
  currentRecipeId?: string;
};

function VariantLink({
  v,
  currentRecipeId,
  label,
  emphasize,
}: {
  v: VariantCard;
  currentRecipeId?: string;
  label?: string;
  emphasize?: boolean;
}) {
  const viewing = currentRecipeId === v.id;
  return (
    <Link
      href={`/recipes/${v.id}`}
      aria-current={viewing ? "page" : undefined}
      className={`card flex min-w-[9.5rem] max-w-[12rem] shrink-0 flex-col overflow-hidden p-0 transition hover:ring-2 hover:ring-ember-200 sm:max-w-none ${
        emphasize ? "ring-1 ring-ember-200" : ""
      } ${viewing ? "ring-2 ring-ember-400" : ""}`}
      data-testid={label ? `variant-featured-${label}` : "variant-rest"}
    >
      <div className="relative">
        <RecipeImage
          src={v.imageUrl}
          alt={v.title}
          variant="card"
          className="!h-24 rounded-none sm:!h-28"
        />
        {label && (
          <span className="absolute left-2 top-2 rounded-full bg-cream-50/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ember-800 shadow-sm">
            {label}
          </span>
        )}
        {viewing && (
          <span className="absolute bottom-2 left-2 rounded-full bg-sage-900/90 px-2 py-0.5 text-[10px] font-semibold text-cream-50">
            You&apos;re viewing
          </span>
        )}
      </div>
      <div className="space-y-1 px-2.5 py-2">
        <p className="text-xs font-semibold leading-snug text-sage-900">
          {v.title}
        </p>
        <RecipeCardRating
          averageStars={v.averageStars}
          reviewCount={v.reviewCount}
        />
      </div>
    </Link>
  );
}

/**
 * Dish-family variants: featured Top rated / Oldest / Surprise band,
 * then the rest of the recipes for that dishKey underneath.
 */
export function RecipeVariants({
  featured,
  rest,
  variants,
  currentRecipeId,
}: Props) {
  const featuredList = featured ?? [];
  const restList = rest ?? variants ?? [];
  if (!featuredList.length && !restList.length) return null;

  return (
    <section className="w-full space-y-4" data-testid="recipe-variants">
      {featuredList.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sage-500">
            Pick a version
          </p>
          <div
            className="grid gap-3 sm:grid-cols-3"
            data-testid="recipe-variants-featured"
          >
            {featuredList.map((f) => (
              <VariantLink
                key={`${f.role}-${f.recipe.id}`}
                v={f.recipe}
                currentRecipeId={currentRecipeId}
                label={f.label}
                emphasize
              />
            ))}
          </div>
        </div>
      )}

      {restList.length > 0 && (
        <aside className="w-full">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sage-500">
            {featuredList.length > 0 ? "More variations" : "Variations"}
          </p>
          <div
            className="flex gap-3 overflow-x-auto pb-1"
            data-testid="recipe-variants-rest"
          >
            {restList.map((v) => (
              <VariantLink
                key={v.id}
                v={v}
                currentRecipeId={currentRecipeId}
              />
            ))}
          </div>
        </aside>
      )}
    </section>
  );
}
