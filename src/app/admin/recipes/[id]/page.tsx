import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { serializeRecipe } from "@/lib/mappers";
import { originLabel } from "@/lib/recipe-taxonomy";
import { hasRecipePhoto } from "@/lib/recipe-image";
import { estimateRecipeNutrition } from "@/lib/recipe-nutrition";
import { youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/origin-story-media";
import {
  ADMIN_FLAG_GROUPS,
  ADMIN_FLAG_KEYS,
  formatAdminDateTime,
  formatIngredientLine,
  formatMinutes,
  ownerDisplay,
  type AdminFlagValues,
} from "@/lib/admin-recipe-display";
import { RecipeImage } from "@/components/RecipeImage";
import { RecipeNutritionCard } from "@/components/RecipeNutritionCard";
import {
  AdminRecipeDetailControls,
  AdminRecipeDetailToolbar,
} from "@/components/AdminRecipeDetailActions";

type Props = { params: Promise<{ id: string }> };

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-sage-900">{title}</h2>
        {aside ? <span className="text-xs text-sage-500">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Chips({ items, tone = "cream" }: { items: string[]; tone?: "cream" | "sage" | "ember" }) {
  if (!items.length) return <span className="text-xs text-sage-400">—</span>;
  const cls =
    tone === "sage"
      ? "bg-sage-100 text-sage-800"
      : tone === "ember"
        ? "bg-ember-100 text-ember-800"
        : "bg-cream-200 text-sage-800";
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((t) => (
        <span key={t} className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
          {t}
        </span>
      ))}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-sage-900">{children}</dd>
    </div>
  );
}

export default async function AdminRecipeDetailPage({ params }: Props) {
  const { id } = await params;
  const [user, raw] = await Promise.all([
    getCurrentUser(),
    prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
        owner: { select: { id: true, name: true, email: true } },
        household: { select: { id: true, name: true } },
        _count: {
          select: { reviews: true, favorites: true, shares: true, cookSessions: true },
        },
      },
    }),
  ]);
  if (!raw) notFound();

  const { owner, household, _count, ...rest } = raw;
  const recipe = serializeRecipe(rest);
  const nutrition = estimateRecipeNutrition(recipe.ingredients, recipe.servings);

  const flags: AdminFlagValues = Object.fromEntries(
    ADMIN_FLAG_KEYS.map((k) => [k, Boolean(recipe[k])])
  );
  const adaptNotes = [
    { label: "Kosher", note: recipe.kosherAdaptNote },
    { label: "Halal", note: recipe.halalAdaptNote },
    { label: "Vegan", note: recipe.veganAdaptNote },
    { label: "Vegetarian", note: recipe.vegetarianAdaptNote },
  ].filter((n) => n.note && n.note.trim());

  const requiredIngredients = recipe.ingredients.filter((i) => !i.optional);
  const optionalIngredients = recipe.ingredients.filter((i) => i.optional);

  // Plain-JSON copy for the collapsed debug panel (dates as ISO strings).
  const rawJson = JSON.stringify(
    { ...recipe, owner, household, counts: _count },
    null,
    2
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/admin/recipes"
          className="text-sm font-medium text-ember-700 hover:underline"
        >
          ← All recipes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-display text-2xl font-bold text-sage-900 sm:text-3xl">
              {recipe.title}
            </h2>
            <p className="mt-1 text-sm text-sage-600">
              {ownerDisplay(owner)}
              {owner?.name && owner.email ? (
                <span className="text-sage-400"> · {owner.email}</span>
              ) : null}
              {household ? (
                <span className="text-sage-400"> · household {household.name || household.id}</span>
              ) : null}
            </p>
          </div>
          <AdminRecipeDetailToolbar
            id={recipe.id}
            title={recipe.title}
            visibility={recipe.visibility}
            canOwnerEdit={Boolean(user && recipe.ownerUserId === user.id)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main column */}
        <div className="min-w-0 space-y-4">
          <Section title="Overview">
            <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
              <div>
                <RecipeImage src={recipe.imageUrl} alt={recipe.title} />
                {!hasRecipePhoto(recipe.imageUrl) && (
                  <p className="mt-1 text-xs font-semibold text-ember-700">Missing photo</p>
                )}
              </div>
              <div className="min-w-0 space-y-3">
                {recipe.description ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-sage-800">
                    {recipe.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-sage-400">No description.</p>
                )}
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Servings">{recipe.servings}</Field>
                  <Field label="Cook time">{formatMinutes(recipe.cookTimeMinutes)}</Field>
                  <Field label="Cost">{recipe.costTier}</Field>
                  <Field label="Reviews">{_count.reviews}</Field>
                  <Field label="Favorites">{_count.favorites}</Field>
                  <Field label="Cooked">{_count.cookSessions}×</Field>
                  <Field label="Shares">{_count.shares}</Field>
                  <Field label="Ingredients">{recipe.ingredients.length}</Field>
                  <Field label="Steps">{recipe.steps.length}</Field>
                </dl>
                {recipe.sourceUrl && (
                  <Field label="Source">
                    <a
                      href={recipe.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-ember-700 hover:underline"
                    >
                      {recipe.sourceUrl}
                    </a>
                  </Field>
                )}
              </div>
            </div>
          </Section>

          <Section title="Ingredients" aside={`${recipe.ingredients.length} total`}>
            {recipe.ingredients.length === 0 ? (
              <p className="text-sm italic text-sage-400">No ingredients.</p>
            ) : (
              <>
                <ul className="grid gap-x-6 gap-y-1 text-sm text-sage-800 sm:grid-cols-2">
                  {requiredIngredients.map((i) => (
                    <li key={i.id} className="flex gap-2">
                      <span aria-hidden className="mt-2 h-1 w-1 flex-none rounded-full bg-sage-400" />
                      <span className="min-w-0 break-words">{formatIngredientLine(i)}</span>
                    </li>
                  ))}
                </ul>
                {optionalIngredients.length > 0 && (
                  <>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                      Optional
                    </p>
                    <ul className="mt-1 grid gap-x-6 gap-y-1 text-sm text-sage-600 sm:grid-cols-2">
                      {optionalIngredients.map((i) => (
                        <li key={i.id} className="flex gap-2">
                          <span aria-hidden className="mt-2 h-1 w-1 flex-none rounded-full bg-sage-300" />
                          <span className="min-w-0 break-words">{formatIngredientLine(i)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </Section>

          <Section title="Steps" aside={`${recipe.steps.length} steps`}>
            {recipe.steps.length === 0 ? (
              <p className="text-sm italic text-sage-400">No steps.</p>
            ) : (
              <ol className="space-y-2">
                {recipe.steps.map((s, idx) => (
                  <li key={idx} className="flex gap-3 text-sm leading-relaxed text-sage-800">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-sage-800 text-xs font-bold text-cream-50">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 break-words pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {(recipe.techniqueTips.length > 0 || recipe.flavorBoosters.length > 0) && (
            <Section title="Chef’s playbook">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                    Technique tips
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sage-800">
                    {recipe.techniqueTips.map((t, i) => (
                      <li key={i} className="whitespace-pre-line break-words">{t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                    Flavor boosters
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sage-800">
                    {recipe.flavorBoosters.map((t, i) => (
                      <li key={i} className="whitespace-pre-line break-words">{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          )}

          <Section
            title="Story behind this food"
            aside={`${recipe.originStoryMedia.length} media`}
          >
            {recipe.originStory ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-sage-800">
                {recipe.originStory}
              </p>
            ) : (
              <p className="text-sm italic text-sage-400">No story yet.</p>
            )}
            {recipe.originStoryMedia.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {recipe.originStoryMedia.map((m) =>
                  m.kind === "image" ? (
                    <li key={m.id}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.url}
                          alt="Story photo"
                          loading="lazy"
                          className="aspect-video w-full rounded-lg bg-cream-100 object-cover ring-1 ring-cream-300"
                        />
                      </a>
                      <p className="mt-0.5 text-[10px] text-sage-500">Photo</p>
                    </li>
                  ) : (
                    <li key={m.id}>
                      <a
                        href={youtubeWatchUrl(m.videoId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={youtubeThumbnailUrl(m.videoId)}
                          alt="YouTube video thumbnail"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="aspect-video w-full rounded-lg bg-cream-100 object-cover ring-1 ring-cream-300"
                        />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">
                            ▶
                          </span>
                        </span>
                      </a>
                      <p className="mt-0.5 text-[10px] text-sage-500">YouTube · {m.videoId}</p>
                    </li>
                  )
                )}
              </ul>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 font-display text-lg font-bold text-sage-900">
              Admin controls
            </h2>
            <AdminRecipeDetailControls
              id={recipe.id}
              title={recipe.title}
              visibility={recipe.visibility}
              flags={flags}
              taxonomy={{
                cuisine: recipe.cuisine,
                course: recipe.course,
                foodCategories: recipe.foodCategories,
                origins: recipe.origins,
                originStory: recipe.originStory,
              }}
            />
          </section>

          <Section title="Taxonomy">
            <dl className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cuisine">{recipe.cuisine || "—"}</Field>
                <Field label="Course">{recipe.course || "—"}</Field>
                <Field label="Meat type">{recipe.meatType || "—"}</Field>
                <Field label="Dish family">{recipe.dishKey || "—"}</Field>
              </div>
              <Field label="Food categories">
                <Chips items={recipe.foodCategories} tone="sage" />
              </Field>
              <Field label="Origins">
                <Chips items={recipe.origins.map(originLabel)} />
              </Field>
              <Field label="Tags">
                <Chips items={recipe.tags} />
              </Field>
              <Field label="Allergens">
                <Chips items={recipe.allergenTags} tone="ember" />
              </Field>
            </dl>
          </Section>

          <Section title="Dietary">
            <div className="space-y-3">
              {ADMIN_FLAG_GROUPS.map((g) => (
                <div key={g.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                    {g.label}
                  </p>
                  <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
                    {g.flags.map((f) => (
                      <li
                        key={f.key}
                        className={flags[f.key] ? "text-sage-900" : "text-sage-400"}
                      >
                        <span aria-hidden className="mr-1">
                          {flags[f.key] ? "✓" : "–"}
                        </span>
                        {f.label}
                        <span className="sr-only">{flags[f.key] ? " yes" : " no"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {adaptNotes.length > 0 && (
                <div className="border-t border-cream-200 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                    Adapt notes
                  </p>
                  <dl className="mt-1 space-y-1.5 text-sm">
                    {adaptNotes.map((n) => (
                      <div key={n.label}>
                        <dt className="text-xs font-semibold text-sage-700">{n.label}</dt>
                        <dd className="text-sage-800">{n.note}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </Section>

          <Section title="Nutrition">
            {nutrition.matchedCount > 0 ? (
              <RecipeNutritionCard estimate={nutrition} />
            ) : (
              <p className="text-sm italic text-sage-400">
                No ingredients matched the nutrition table.
              </p>
            )}
          </Section>

          <Section title="Record">
            <dl className="space-y-2">
              <Field label="Recipe ID">
                <code className="break-all text-xs">{recipe.id}</code>
              </Field>
              <Field label="Created">{formatAdminDateTime(recipe.createdAt)}</Field>
              <Field label="Updated">{formatAdminDateTime(recipe.updatedAt)}</Field>
              <Field label="Household">
                {household ? household.name || household.id : "— (shared catalog)"}
              </Field>
            </dl>
          </Section>
        </aside>
      </div>

      <details className="card group p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-sage-700">
          Raw data <span className="font-normal text-sage-400">(for debugging)</span>
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-sage-900 p-3 text-[11px] leading-relaxed text-cream-50">
          {rawJson}
        </pre>
      </details>
    </div>
  );
}
