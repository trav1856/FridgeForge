"use client";

import { useEffect, useMemo, useState } from "react";
import {
  convertRecipeIngredients,
  formatQuantity,
} from "@/lib/unit-convert";
import {
  readStoredUnitSystem,
  storeUnitSystem,
  type UnitSystem,
} from "@/lib/units";

export type RecipeIngredientView = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  optional: boolean;
};

type Props = {
  ingredients: RecipeIngredientView[];
  /** Optional compact mode for cards / cook strips. */
  compact?: boolean;
};

export function UnitSystemToggle({
  system,
  onChange,
  className = "",
}: {
  system: UnitSystem;
  onChange: (s: UnitSystem) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-full border border-sage-200 bg-cream-50 p-0.5 text-xs font-semibold ${className}`}
      role="group"
      aria-label="Unit system"
    >
      <button
        type="button"
        onClick={() => onChange("imperial")}
        className={
          system === "imperial"
            ? "rounded-full bg-ember-600 px-3 py-1 text-white shadow-sm"
            : "rounded-full px-3 py-1 text-sage-700 hover:bg-white"
        }
      >
        Imperial
      </button>
      <button
        type="button"
        onClick={() => onChange("metric")}
        className={
          system === "metric"
            ? "rounded-full bg-ember-600 px-3 py-1 text-white shadow-sm"
            : "rounded-full px-3 py-1 text-sage-700 hover:bg-white"
        }
      >
        Metric
      </button>
    </div>
  );
}

export function useUnitSystemPreference(
  fallback: UnitSystem = "imperial"
): [UnitSystem, (s: UnitSystem) => void] {
  const [system, setSystem] = useState<UnitSystem>(fallback);
  useEffect(() => {
    setSystem(readStoredUnitSystem(fallback));
  }, [fallback]);

  function update(next: UnitSystem) {
    setSystem(next);
    storeUnitSystem(next);
  }

  return [system, update];
}

export function RecipeIngredients({ ingredients, compact }: Props) {
  const [system, setSystem] = useUnitSystemPreference("imperial");

  const displayed = useMemo(
    () => convertRecipeIngredients(ingredients, system),
    [ingredients, system]
  );

  return (
    <section className={compact ? "" : "card p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-sage-900">
          Ingredients
        </h2>
        <UnitSystemToggle system={system} onChange={setSystem} />
      </div>
      {system === "metric" && (
        <p className="mt-1 text-xs text-sage-500">
          Amounts shown in metric (steps stay as authored).
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {displayed.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 text-sm">
            <span className="text-sage-900">
              {i.name}
              {i.optional ? (
                <span className="text-sage-500"> (optional)</span>
              ) : null}
            </span>
            <span className="shrink-0 text-sage-600">
              {formatQuantity(i.quantity)} {i.unit}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
