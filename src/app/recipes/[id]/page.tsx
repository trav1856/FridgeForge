import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/mappers";
import { getCurrentUser, resolveHouseholdId } from "@/lib/auth";
import { canRequestRecipe, recipeIsReadable } from "@/lib/recipe-request";
import { estimateRecipeNutrition } from "@/lib/recipe-nutrition";
import { RecipeDeals } from "@/components/RecipeDeals";
import { RecipeImage } from "@/components/RecipeImage";
import { RecipeIngredients } from "@/components/RecipeIngredients";
import { RecipeIcons } from "@/components/RecipeIcons";
import { RecipeDetailActions } from "@/components/RecipeDetailActions";
import { RecipePhotoUpload } from "@/components/RecipePhotoUpload";
import { canEditRecipeImage } from "@/lib/recipe-user-images";
import { RecipeNutritionCard } from "@/components/RecipeNutritionCard";
import { RecipeReviews } from "@/components/RecipeReviews";
import { RecipeOriginStory } from "@/components/RecipeOriginStory";
import { RecipeVariants } from "@/components/RecipeVariants";
import { dishKeyForTitle } from "@/lib/dish-key";
import { pickDishVariantHighlights } from "@/lib/dish-variant-picks";
import {
  getReviewStatsByRecipeIds,
  reviewStatsFor,
} from "@/lib/recipe-review-stats";
import { recipeListAccessWhere } from "@/lib/recipe-visibility";

type Props = { params: Promise<{ id: string }> };

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const householdId = await resolveHouseholdId();
  const raw = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: true,
      ...(user
        ? {
            favorites: {
              where: { userId: user.id },
              select: { id: true },
            },
          }
        : {}),
      shares: {
        select: {
          toUserId: true,
          toUserEmail: true,
          toHouseholdId: true,
        },
      },
    },
  });
  if (
    !raw ||
    !recipeIsReadable(raw, householdId, {
      userId: user?.id,
      userEmail: user?.email,
    })
  )
    notFound();
  const showRequest = canRequestRecipe(
    {
      id: raw.id,
      householdId: raw.householdId,
      ownerUserId: raw.ownerUserId,
      visibility: raw.visibility,
    },
    user ? { userId: user.id, householdId } : null
  );
  const canEditPhoto = canEditRecipeImage(
    { ownerUserId: raw.ownerUserId, householdId: raw.householdId },
    { userId: user?.id ?? null, householdId }
  );
  const favorited =
    user && Array.isArray((raw as { favorites?: unknown[] }).favorites)
      ? ((raw as { favorites: unknown[] }).favorites.length > 0)
      : false;
  const { favorites: _f, shares: _shares, ...rest } = raw as typeof raw & {
    favorites?: unknown;
    shares?: unknown;
  };
  const recipe = serializeRecipe(rest);

  const nutritionEstimate = estimateRecipeNutrition(
    recipe.ingredients,
    recipe.servings
  );

  const hasPlaybook =
    recipe.techniqueTips.length > 0 || recipe.flavorBoosters.length > 0;

  const dishKey =
    (raw as { dishKey?: string | null }).dishKey ||
    dishKeyForTitle(recipe.title);

  let featuredVariants: ReturnType<
    typeof pickDishVariantHighlights<{
      id: string;
      title: string;
      imageUrl: string | null;
      createdAt: Date;
      averageStars: number | null;
      reviewCount: number;
    }>
  >["featured"] = [];
  let restVariants: {
    id: string;
    title: string;
    imageUrl: string | null;
    averageStars?: number | null;
    reviewCount?: number;
  }[] = [];

  if (dishKey) {
    const access = recipeListAccessWhere({
      userId: user?.id,
      userEmail: user?.email,
      householdId,
    });
    const rows = await prisma.recipe.findMany({
      where: {
        AND: [
          access,
          {
            OR: [
              { dishKey },
              // Fallback: same cuisine+course with title containing significant token
              ...(recipe.cuisine && recipe.course
                ? [
                    {
                      cuisine: recipe.cuisine,
                      course: recipe.course,
                      title: {
                        contains: dishKey.split("-").slice(0, 2).join(" "),
                        mode: "insensitive" as const,
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        dishKey: true,
        createdAt: true,
      },
      take: 48,
      orderBy: { createdAt: "asc" },
    });
    // Prefer exact dishKey matches; de-dupe; include current recipe in the pool
    const exact = rows.filter((r) => r.dishKey === dishKey);
    const fuzzy = rows.filter((r) => r.dishKey !== dishKey);
    const seen = new Set<string>();
    const pooled: typeof rows = [];
    for (const r of [...exact, ...fuzzy]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      pooled.push(r);
      if (pooled.length >= 24) break;
    }

    const reviewStats = await getReviewStatsByRecipeIds(pooled.map((r) => r.id));
    const candidates = pooled.map((r) => {
      const stats = reviewStatsFor(reviewStats, r.id);
      return {
        id: r.id,
        title: r.title,
        imageUrl: r.imageUrl,
        createdAt: r.createdAt,
        averageStars: stats.averageStars,
        reviewCount: stats.reviewCount,
      };
    });

    const picks = pickDishVariantHighlights(candidates);
    featuredVariants = picks.featured;
    restVariants = picks.rest.map((r) => ({
      id: r.id,
      title: r.title,
      imageUrl: r.imageUrl,
      averageStars: r.averageStars,
      reviewCount: r.reviewCount,
    }));
  }

  return (
    <article className="space-y-6">
      <div>
        <Link href="/recipes" className="text-sm font-medium text-ember-700 hover:underline">
          ← Recipes
        </Link>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className={`badge ${recipe.costTier === "cheap" ? "bg-sage-100 text-sage-800" : "bg-ember-50 text-ember-800"}`}>
            {recipe.costTier}
          </span>
          {recipe.isStruggleMeal && (
            <span className="badge bg-ember-600 text-white">struggle meal</span>
          )}
          {recipe.cuisine && (
            <span className="badge bg-sage-200 text-sage-900">{recipe.cuisine}</span>
          )}
          {recipe.course && (
            <span className="badge bg-cream-300 text-sage-800">{recipe.course}</span>
          )}
          {(recipe.foodCategories || []).slice(0, 4).map((c: string) => (
            <span key={`fc-${c}`} className="badge bg-cream-200 text-sage-700">
              {c}
            </span>
          ))}
          {(recipe.origins || []).slice(0, 4).map((o: string) => (
            <span key={`or-${o}`} className="badge bg-ember-50 text-ember-800">
              {o}
            </span>
          ))}
          {recipe.visibility && (
            <span className="badge bg-cream-200 text-sage-700">
              {recipe.visibility === "public"
                ? "global"
                : recipe.visibility === "private"
                  ? "household"
                  : recipe.visibility}
            </span>
          )}
          {recipe.tags.map((t) => (
            <span key={t} className="badge bg-cream-200 text-sage-700">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 max-w-2xl space-y-3">
          <RecipeImage src={recipe.imageUrl} alt={recipe.title} variant="hero" />
          {canEditPhoto && (
            <div className="card p-4">
              <RecipePhotoUpload
                recipeId={recipe.id}
                imageUrl={recipe.imageUrl}
                alt={recipe.title}
                showPreview={false}
              />
            </div>
          )}
        </div>
        {(featuredVariants.length > 0 || restVariants.length > 0) && (
          <div className="mt-4 max-w-4xl">
            <RecipeVariants
              featured={featuredVariants}
              rest={restVariants}
              currentRecipeId={recipe.id}
            />
          </div>
        )}
        <RecipeIcons
          title={recipe.title}
          tags={recipe.tags}
          ingredients={recipe.ingredients}
          description={recipe.description}
          flavorBoosters={recipe.flavorBoosters}
          className="mt-3"
        />
        <h1 className="mt-3 font-display text-3xl font-bold text-sage-900 sm:text-4xl">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="mt-2 max-w-2xl text-sage-700">{recipe.description}</p>
        )}
        <p className="mt-2 text-sm text-sage-500">
          {recipe.servings} servings
          {recipe.cookTimeMinutes != null ? ` · ${recipe.cookTimeMinutes} min` : ""}
          {recipe.sourceUrl && (
            <>
              {" · "}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ember-700 hover:underline"
              >
                Source
              </a>
            </>
          )}
        </p>
        <div className="mt-4">
          <RecipeDetailActions
            recipeId={recipe.id}
            title={recipe.title}
            favorited={favorited}
            ingredientNames={recipe.ingredients.map((i) => i.name)}
            showRequest={showRequest}
          />
        </div>
      </div>

      <RecipeDeals recipeId={recipe.id} recipeTitle={recipe.title} />

      <div className="grid gap-4 md:grid-cols-2">
        <RecipeIngredients ingredients={recipe.ingredients} />

        <section className="card p-5">
          <h2 className="font-display text-lg font-bold text-sage-900">Steps</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-sage-800">
            {recipe.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </section>
      </div>

      {(nutritionEstimate.totalCount > 0 || hasPlaybook) && (
        <div
          className={
            hasPlaybook && nutritionEstimate.totalCount > 0
              ? "grid gap-4 md:grid-cols-2"
              : "grid gap-4"
          }
        >
          {nutritionEstimate.totalCount > 0 && (
            <RecipeNutritionCard estimate={nutritionEstimate} />
          )}

          {hasPlaybook && (
            <section className="card border-ember-100 bg-gradient-to-br from-ember-50/80 to-cream-50 p-5">
              <h2 className="font-display text-lg font-bold text-ember-900">
                Proud-plate playbook
              </h2>
              {recipe.flavorBoosters.length > 0 && (
                <p className="mt-2 text-sm text-sage-800">
                  <span className="font-semibold">Flavor boosters:</span>{" "}
                  {recipe.flavorBoosters.join(" · ")}
                </p>
              )}
              {recipe.techniqueTips.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-sage-800">
                  {recipe.techniqueTips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <RecipeOriginStory title={recipe.title} originStory={recipe.originStory} />
      <RecipeReviews recipeId={recipe.id} recipeTitle={recipe.title} />

    </article>
  );
}
