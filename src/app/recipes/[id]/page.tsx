import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { serializeRecipe } from "@/lib/mappers";
import { RecipeDeals } from "@/components/RecipeDeals";
import { RecipeImage } from "@/components/RecipeImage";
import { RecipeIngredients } from "@/components/RecipeIngredients";

type Props = { params: Promise<{ id: string }> };

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const raw = await prisma.recipe.findUnique({
    where: { id },
    include: { ingredients: true },
  });
  if (!raw) notFound();
  const recipe = serializeRecipe(raw);

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
          {recipe.tags.map((t) => (
            <span key={t} className="badge bg-cream-200 text-sage-700">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 max-w-2xl">
          <RecipeImage src={recipe.imageUrl} alt={recipe.title} variant="hero" />
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-sage-900 sm:text-4xl">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="mt-2 max-w-2xl text-sage-700">{recipe.description}</p>
        )}
        <p className="mt-2 text-sm text-sage-500">
          {recipe.servings} servings
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
      </div>

      <RecipeDeals recipeId={recipe.id} />

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

      {(recipe.techniqueTips.length > 0 || recipe.flavorBoosters.length > 0) && (
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
    </article>
  );
}
