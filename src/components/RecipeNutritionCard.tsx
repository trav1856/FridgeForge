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
    return <span className="tabular-nums text-black/40">—</span>;
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
        "flex items-end justify-between gap-2 py-[2px] text-[13px] leading-tight text-black",
        thickTop ? "border-t-[7px] border-black pt-1" : "",
        thinTop ? "border-t border-black" : "",
        indent ? "pl-4" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0 flex-1">
        <span className={bold ? "font-bold" : "font-normal"}>{label}</span>
        {amountText != null && (
          <>
            {" "}
            <span className="tabular-nums">{amountText}</span>
          </>
        )}
      </div>
      {showDv && (
        <div className="shrink-0 font-bold tabular-nums">{dv ?? null}</div>
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
    <div className="flex items-end justify-between border-t border-black py-[3px] text-[13px] leading-tight text-black">
      <span>
        {label} {fmtAmount(amount, unit === "mcg" ? 1 : 0)}
        {unit}
      </span>
      <span className="font-bold">
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
    return <span className="tabular-nums text-black/40">—</span>;
  }
  return <DvCell amount={value} nutrient={nutrient} />;
}

/** FDA-style Nutrition Facts label estimated from recipe ingredients. */
export function RecipeNutritionCard({ estimate, className = "" }: Props) {
  const { perServing, total, coverageLabel, matchedCount, servings } = estimate;
  const [mode, setMode] = useState<"serving" | "recipe">("serving");

  if (estimate.totalCount === 0) return null;

  const macros: Macros = mode === "serving" ? perServing : total;
  const servingsLine =
    servings === 1
      ? "1 serving per container"
      : `${servings} servings per container`;

  return (
    <section className={className}>
      {matchedCount === 0 ? (
        <div className="rounded-lg border border-sage-200 bg-cream-50 p-4 text-sm text-sage-700">
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
              <span className="text-sage-400">
                {" "}
                · default shows per serving
              </span>
            </p>
            <div
              className="inline-flex overflow-hidden rounded-md border border-sage-200 text-[11px] font-semibold"
              role="group"
              aria-label="Nutrition amount basis"
            >
              <button
                type="button"
                onClick={() => setMode("serving")}
                className={
                  mode === "serving"
                    ? "bg-sage-800 px-2.5 py-1 text-white"
                    : "bg-white px-2.5 py-1 text-sage-700 hover:bg-sage-50"
                }
              >
                Per serving
              </button>
              <button
                type="button"
                onClick={() => setMode("recipe")}
                className={
                  mode === "recipe"
                    ? "bg-sage-800 px-2.5 py-1 text-white"
                    : "bg-white px-2.5 py-1 text-sage-700 hover:bg-sage-50"
                }
              >
                Whole recipe
              </button>
            </div>
          </div>

          <div
            className="w-full max-w-[320px] border-[3px] border-black bg-white p-1 text-black"
            style={{
              fontFamily: 'Arial, Helvetica, "Helvetica Neue", sans-serif',
            }}
          >
            <div className="border-b-[14px] border-black px-1 pb-0.5">
              <h2 className="text-[36px] font-black leading-none tracking-tight">
                Nutrition Facts
              </h2>
            </div>

            <div className="border-b border-black px-1 py-1 text-[14px] leading-snug">
              <div>{servingsLine}</div>
              <div className="flex justify-between font-bold">
                <span>Serving size</span>
                <span>
                  {mode === "serving"
                    ? "1 serving"
                    : `1 recipe (${servings} serv.)`}
                </span>
              </div>
            </div>

            <div className="border-b-[7px] border-black px-1 py-1">
              <div className="text-[11px] font-bold leading-none">
                Amount per serving
              </div>
              <div className="flex items-end justify-between">
                <span className="text-[28px] font-black leading-none">
                  Calories
                </span>
                <span className="text-[36px] font-black leading-none tabular-nums">
                  {fmtAmount(macros.kcal)}
                </span>
              </div>
            </div>

            <div className="border-b border-black px-1 py-0.5 text-right text-[11px] font-bold">
              % Daily Value*
            </div>

            <div className="px-1">
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

            <div className="border-t-[14px] border-black px-1 pt-0.5">
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

            <div className="mt-1 border-t border-black px-1 pt-1 text-[10px] leading-snug text-black">
              <p>
                * The % Daily Value (DV) tells you how much a nutrient in a
                serving of food contributes to a daily diet. 2,000 calories a
                day is used for general nutrition advice.
              </p>
              <p className="mt-1">
                Estimated from recipe ingredients — not a lab analysis.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
