import type { RecipeNutritionEstimate } from "@/lib/recipe-nutrition";

type Props = {
  estimate: RecipeNutritionEstimate;
  className?: string;
};

function MacroStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2 text-center ring-1 ring-sage-100">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-sage-500">
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg font-bold tabular-nums text-sage-900">
        {value}
        <span className="ml-0.5 text-xs font-medium text-sage-500">{unit}</span>
      </div>
    </div>
  );
}

/** Dietary index card — estimated macros from recipe ingredients. */
export function RecipeNutritionCard({ estimate, className = "" }: Props) {
  const { perServing, total, coverageLabel, matchedCount, servings } = estimate;

  if (estimate.totalCount === 0) return null;

  return (
    <section
      className={`card border-sage-100 bg-gradient-to-br from-sage-50/90 to-cream-50 p-5 ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Dietary index
        </h2>
        <p className="text-xs font-medium text-sage-500">
          estimated from ingredients
        </p>
      </div>

      {matchedCount === 0 ? (
        <p className="mt-3 text-sm text-sage-600">
          Couldn&apos;t estimate nutrition for these ingredients yet. Values are
          approximate when available.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-sage-600">
            Per serving
            {servings > 1 ? ` (÷ ${servings})` : ""} · totals in parentheses
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MacroStat label="Calories" value={perServing.kcal} unit="kcal" />
            <MacroStat label="Protein" value={perServing.protein} unit="g" />
            <MacroStat label="Fat" value={perServing.fat} unit="g" />
            <MacroStat label="Carbs" value={perServing.carbs} unit="g" />
          </div>

          {(perServing.fiber != null || perServing.sodium != null) && (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-sage-600">
              {perServing.fiber != null && (
                <span>
                  Fiber ~{perServing.fiber}g
                  <span className="text-sage-400">
                    {" "}
                    ({total.fiber ?? 0}g total)
                  </span>
                </span>
              )}
              {perServing.sodium != null && (
                <span>
                  Sodium ~{perServing.sodium}mg
                  <span className="text-sage-400">
                    {" "}
                    ({total.sodium ?? 0}mg total)
                  </span>
                </span>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-sage-500">
            Recipe total ≈ {total.kcal} kcal · {total.protein}g protein ·{" "}
            {total.fat}g fat · {total.carbs}g carbs
          </p>
        </>
      )}

      {coverageLabel && (
        <p className="mt-2 text-xs text-sage-500">{coverageLabel}</p>
      )}
      <p className="mt-1 text-[11px] leading-snug text-sage-400">
        Dietary index · estimated from ingredients — not a lab analysis. Round
        numbers for home cooking.
      </p>
    </section>
  );
}
