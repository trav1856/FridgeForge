"use client";

import { useState } from "react";
import type { Macros, RecipeNutritionEstimate } from "@/lib/recipe-nutrition";
import {
  percentDailyValue,
  type FdaDailyValueKey,
} from "@/lib/recipe-nutrition";

type Props = {
  estimate: RecipeNutritionEstimate;
  className?: string;
};

function fmtAmount(n: number | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (decimals === 0) return String(Math.round(n));
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function DvCell({
  amount,
  nutrient,
}: {
  amount: number | undefined;
  nutrient: FdaDailyValueKey;
}) {
  const pct = percentDailyValue(amount, nutrient);
  if (pct == null) {
    return <span className="tabular-nums text-sage-400">—</span>;
  }
  return <span className="tabular-nums">{pct}%</span>;
}

function NutrientRow({
  label,
  amountText,
  dv,
  bold,
  indent,
  thickTop,
  thinTop,
  showDv = true,
}: {
  label: React.ReactNode;
  amountText?: React.ReactNode;
  dv?: React.ReactNode;
  bold?: boolean;
  indent?: boolean;
  thickTop?: boolean;
  thinTop?: boolean;
  showDv?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-end justify-between gap-2 py-1 text-sm leading-tight text-sage-900",
        thickTop ? "mt-1 border-t-4 border-sage-800 pt-2" : "",
        thinTop ? "border-t border-sage-200" : "",
        indent ? "pl-4" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0 flex-1">
        <span className={bold ? "font-semibold" : "font-normal"}>{label}</span>
        {amountText != null && (
          <>
            {" "}
            <span className="tabular-nums text-sage-800">{amountText}</span>
          </>
        )}
      </div>
      {showDv && (
        <div className="shrink-0 font-semibold tabular-nums text-sage-800">
          {dv ?? null}
        </div>
      )}
    </div>
  );
}

function amountWithUnit(
  value: number | undefined,
  unit: string,
  decimals = 1
): string {
  if (value === undefined) return "—";
  return `${fmtAmount(value, decimals)}${unit}`;
}

function VitaminRow({
  label,
  amount,
  unit,
  nutrient,
}: {
  label: string;
  amount: number | undefined;
  unit: string;
  nutrient: FdaDailyValueKey;
}) {
  if (amount === undefined) return null;
  return (
    <div className="flex items-end justify-between border-t border-sage-200 py-1.5 text-sm leading-tight text-sage-900">
      <span>
        {label} {fmtAmount(amount, unit === "mcg" ? 1 : 0)}
        {unit}
      </span>
      <span className="font-semibold text-sage-800">
        <DvCell amount={amount} nutrient={nutrient} />
      </span>
    </div>
  );
}

function optionalDv(
  value: number | undefined,
  nutrient: FdaDailyValueKey
): React.ReactNode {
  if (value === undefined) {
    return <span className="tabular-nums text-sage-400">—</span>;
  }
  return <DvCell amount={value} nutrient={nutrient} />;
}

/** FridgeForge-themed Nutrition Facts (FDA info structure, app styling). */
export function RecipeNutritionCard({ estimate, className = "" }: Props) {
  const { perServing, total, coverageLabel, matchedCount, servings } = estimate;
  const [mode, setMode] = useState<"serving" | "recipe">("serving");

  if (estimate.totalCount === 0) return null;

  const macros: Macros = mode === "serving" ? perServing : total;
  const servingsLine =
    servings === 1
      ? "1 serving per recipe"
      : `${servings} servings per recipe`;

  return (
    <section className={className}>
      {matchedCount === 0 ? (
        <div className="card border-sage-100 bg-gradient-to-br from-sage-50/90 to-cream-50 p-5 text-sm text-sage-700">
          Couldn&apos;t estimate nutrition for these ingredients yet. Values are
          approximate when available.
          {coverageLabel && (
            <p className="mt-2 text-xs text-sage-500">{coverageLabel}</p>
          )}
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-sage-500">
              {coverageLabel}
              <span className="text-sage-400"> · default shows per serving</span>
            </p>
            <div
              className="inline-flex overflow-hidden rounded-full border border-sage-200 text-[11px] font-semibold"
              role="group"
              aria-label="Nutrition amount basis"
            >
              <button
                type="button"
                onClick={() => setMode("serving")}
                className={
                  mode === "serving"
                    ? "bg-sage-800 px-3 py-1 text-cream-50"
                    : "bg-cream-50 px-3 py-1 text-sage-700 hover:bg-sage-100"
                }
              >
                Per serving
              </button>
              <button
                type="button"
                onClick={() => setMode("recipe")}
                className={
                  mode === "recipe"
                    ? "bg-sage-800 px-3 py-1 text-cream-50"
                    : "bg-cream-50 px-3 py-1 text-sage-700 hover:bg-sage-100"
                }
              >
                Whole recipe
              </button>
            </div>
          </div>

          <div className="card w-full max-w-[340px] overflow-hidden border-sage-200/80 bg-gradient-to-br from-cream-50 to-sage-50/60 p-0 shadow-sm">
            <div className="border-b-4 border-ember-600 bg-cream-50/90 px-4 pb-2 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ember-700">
                FridgeForge
              </p>
              <h2 className="font-display text-2xl font-bold leading-tight text-sage-900">
                Nutrition Facts
              </h2>
            </div>

            <div className="border-b border-sage-200 px-4 py-2 text-sm leading-snug text-sage-800">
              <div>{servingsLine}</div>
              <div className="mt-0.5 flex justify-between font-semibold text-sage-900">
                <span>Serving size</span>
                <span>
                  {mode === "serving"
                    ? "1 serving"
                    : `1 recipe (${servings} serv.)`}
                </span>
              </div>
            </div>

            <div className="border-b-4 border-sage-800 px-4 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-sage-500">
                Amount per serving
              </div>
              <div className="mt-1 flex items-end justify-between">
                <span className="font-display text-xl font-bold text-sage-900">
                  Calories
                </span>
                <span className="font-display text-3xl font-bold tabular-nums text-ember-700">
                  {fmtAmount(macros.kcal)}
                </span>
              </div>
            </div>

            <div className="border-b border-sage-200 px-4 py-1 text-right text-[11px] font-semibold text-sage-500">
              % Daily Value*
            </div>

            <div className="px-4 pb-1">
              <NutrientRow
                label="Total Fat"
                amountText={amountWithUnit(macros.fat, "g")}
                bold
                thinTop
                dv={<DvCell amount={macros.fat} nutrient="fat" />}
              />
              <NutrientRow
                label="Saturated Fat"
                amountText={amountWithUnit(macros.saturatedFat, "g")}
                indent
                thinTop
                dv={optionalDv(macros.saturatedFat, "saturatedFat")}
              />
              <NutrientRow
                label={
                  <>
                    <em>Trans</em> Fat
                  </>
                }
                amountText={amountWithUnit(macros.transFat, "g")}
                indent
                thinTop
                showDv={false}
              />
              <NutrientRow
                label="Cholesterol"
                amountText={amountWithUnit(macros.cholesterol, "mg", 0)}
                bold
                thinTop
                dv={optionalDv(macros.cholesterol, "cholesterol")}
              />
              <NutrientRow
                label="Sodium"
                amountText={amountWithUnit(macros.sodium, "mg", 0)}
                bold
                thinTop
                dv={optionalDv(macros.sodium, "sodium")}
              />
              <NutrientRow
                label="Total Carbohydrate"
                amountText={amountWithUnit(macros.carbs, "g")}
                bold
                thinTop
                dv={<DvCell amount={macros.carbs} nutrient="carbs" />}
              />
              <NutrientRow
                label="Dietary Fiber"
                amountText={amountWithUnit(macros.fiber, "g")}
                indent
                thinTop
                dv={optionalDv(macros.fiber, "fiber")}
              />
              <NutrientRow
                label="Total Sugars"
                amountText={amountWithUnit(macros.sugars, "g")}
                indent
                thinTop
                showDv={false}
              />
              <NutrientRow
                label={
                  <>
                    Includes {amountWithUnit(macros.addedSugars, "g")} Added
                    Sugars
                  </>
                }
                indent
                thinTop
                dv={optionalDv(macros.addedSugars, "addedSugars")}
              />
              <NutrientRow
                label="Protein"
                amountText={amountWithUnit(macros.protein, "g")}
                bold
                thickTop
                dv={<DvCell amount={macros.protein} nutrient="protein" />}
              />
            </div>

            <div className="border-t-4 border-sage-800 px-4 pt-1">
              <VitaminRow
                label="Vitamin D"
                amount={macros.vitaminD}
                unit="mcg"
                nutrient="vitaminD"
              />
              <VitaminRow
                label="Calcium"
                amount={macros.calcium}
                unit="mg"
                nutrient="calcium"
              />
              <VitaminRow
                label="Iron"
                amount={macros.iron}
                unit="mg"
                nutrient="iron"
              />
              <VitaminRow
                label="Potassium"
                amount={macros.potassium}
                unit="mg"
                nutrient="potassium"
              />
            </div>

            <div className="mt-1 border-t border-sage-200 bg-sage-50/50 px-4 py-3 text-[10px] leading-snug text-sage-600">
              <p>
                * The % Daily Value (DV) tells you how much a nutrient in a
                serving of food contributes to a daily diet. 2,000 calories a
                day is used for general nutrition advice.
              </p>
              <p className="mt-1.5 text-sage-500">
                FridgeForge estimate from recipe ingredients — not a lab
                analysis.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
