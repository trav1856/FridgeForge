import { namesMatch } from "./normalize";
import { convertToUnit, formatQuantity, roundCooking } from "./unit-convert";

export type DeductIngredient = {
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
};

export type DeductPantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

export type PantryDeduction = {
  pantryItemId: string;
  name: string;
  unit: string;
  deductedQty: number;
  quantityBefore: number;
  quantityAfter: number;
  lowStock: boolean;
  lowStockMessage: string | null;
};

export type DeductPlan = {
  deductions: PantryDeduction[];
  skipped: { name: string; reason: string }[];
  lowStockMessages: string[];
};

/** Absolute low-stock floors by normalized unit key. */
const ABSOLUTE_LOW: Record<string, number> = {
  lb: 0.25,
  lbs: 0.25,
  pound: 0.25,
  pounds: 0.25,
  oz: 2,
  ounce: 2,
  ounces: 2,
  g: 50,
  gram: 50,
  grams: 50,
  kg: 0.1,
  kilogram: 0.1,
  kilograms: 0.1,
  cup: 0.25,
  cups: 0.25,
  c: 0.25,
  tbsp: 2,
  tablespoon: 2,
  tablespoons: 2,
  tsp: 3,
  teaspoon: 3,
  teaspoons: 3,
  "fl oz": 2,
  floz: 2,
  ml: 60,
  l: 0.1,
  each: 1,
  ea: 1,
  can: 1,
  cans: 1,
};

function unitKey(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/^fluid\s+oz$/, "fl oz")
    .replace(/^fl\.?\s*oz$/, "fl oz");
}

/**
 * True when remaining is empty, ≤25% of pre-cook amount, or below a small
 * absolute threshold for that unit.
 */
export function isLowStock(
  quantityAfter: number,
  quantityBefore: number,
  unit: string
): boolean {
  if (quantityAfter <= 0) return true;
  if (quantityBefore > 0 && quantityAfter <= quantityBefore * 0.25) return true;
  const floor = ABSOLUTE_LOW[unitKey(unit)];
  if (floor != null && quantityAfter <= floor) return true;
  return false;
}

export function lowStockMessage(
  name: string,
  quantityAfter: number,
  unit: string
): string {
  if (quantityAfter <= 0) {
    return `You probably need more ${name}.`;
  }
  return `You're low on ${name} — about ${formatQuantity(roundCooking(quantityAfter))} ${unit} left`;
}

/** How much of the pantry unit to deduct for a recipe amount (null if incompatible). */
export function amountToDeductInPantryUnit(
  recipeQty: number,
  recipeUnit: string,
  pantryUnit: string
): number | null {
  const converted = convertToUnit(recipeQty, recipeUnit, pantryUnit);
  if (converted == null) return null;
  return roundCooking(converted);
}

export function findMatchingPantryItem<T extends { name: string }>(
  ingredientName: string,
  pantry: T[]
): T | undefined {
  return pantry.find((p) => namesMatch(p.name, ingredientName));
}

/**
 * Plan pantry deductions for a cook. Optional ingredients are only deducted
 * when a matching pantry row exists; otherwise skipped. Qty floors at 0.
 */
export function planPantryDeductions(
  ingredients: DeductIngredient[],
  pantry: DeductPantryItem[]
): DeductPlan {
  const deductions: PantryDeduction[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const qtyById = new Map(pantry.map((p) => [p.id, p.quantity]));

  for (const ing of ingredients) {
    const pantryItem = findMatchingPantryItem(ing.name, pantry);

    if (!pantryItem) {
      skipped.push({
        name: ing.name,
        reason: ing.optional ? "optional_missing" : "not_in_pantry",
      });
      continue;
    }

    const need = amountToDeductInPantryUnit(
      ing.quantity,
      ing.unit,
      pantryItem.unit
    );
    if (need == null) {
      skipped.push({ name: ing.name, reason: "unit_mismatch" });
      continue;
    }

    const before = qtyById.get(pantryItem.id) ?? pantryItem.quantity;
    const after = Math.max(0, roundCooking(before - need));
    qtyById.set(pantryItem.id, after);

    const existing = deductions.find((d) => d.pantryItemId === pantryItem.id);
    if (existing) {
      existing.deductedQty = roundCooking(existing.quantityBefore - after);
      existing.quantityAfter = after;
      existing.lowStock = isLowStock(
        after,
        existing.quantityBefore,
        existing.unit
      );
      existing.lowStockMessage = existing.lowStock
        ? lowStockMessage(existing.name, after, existing.unit)
        : null;
    } else {
      const deducted = roundCooking(before - after);
      const low = isLowStock(after, before, pantryItem.unit);
      deductions.push({
        pantryItemId: pantryItem.id,
        name: pantryItem.name,
        unit: pantryItem.unit,
        deductedQty: deducted,
        quantityBefore: before,
        quantityAfter: after,
        lowStock: low,
        lowStockMessage: low
          ? lowStockMessage(pantryItem.name, after, pantryItem.unit)
          : null,
      });
    }
  }

  const lowStockMessages = deductions
    .filter((d) => d.lowStock && d.lowStockMessage)
    .map((d) => d.lowStockMessage!);

  return { deductions, skipped, lowStockMessages };
}

/** Reverse a stored deduction list back to quantityBefore values. */
export function planPantryRestore(
  deductions: Pick<
    PantryDeduction,
    "pantryItemId" | "quantityBefore"
  >[]
): { pantryItemId: string; quantity: number }[] {
  return deductions.map((d) => ({
    pantryItemId: d.pantryItemId,
    quantity: d.quantityBefore,
  }));
}
