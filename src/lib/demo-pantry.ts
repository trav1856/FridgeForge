/**
 * Guest demo pantry: a static fixture that lives only in the browser
 * (localStorage). Pure helpers here so they can be unit-tested; the
 * browser store is in demo-pantry-store.ts. Nothing here touches the DB.
 */
import { normalizeName } from "./normalize";

export type DemoPantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  tags: string[];
  barcode: string | null;
  expirationDate: string | null;
  nutritionJson: string | null;
  imageUrl: string | null;
};

export type DemoPantryInput = {
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  tags?: string[];
  barcode?: string | null;
  expirationDate?: string | null;
  nutritionJson?: string | null;
  imageUrl?: string | null;
};

type Seed = [name: string, quantity: number, unit: string, category: string, tags: string[]];

/** Roughly the old shared seed pantry (17 everyday staples). */
const SEED: Seed[] = [
  ["White rice", 4, "cups", "Grains", ["staple", "struggle"]],
  ["Eggs", 12, "each", "Proteins", ["staple", "struggle"]],
  ["Canned tuna", 2, "cans", "Canned", ["staple", "struggle"]],
  ["Yellow onion", 3, "each", "Produce", ["staple"]],
  ["Garlic", 1, "head", "Produce", ["staple", "flavor"]],
  ["Potatoes", 5, "each", "Produce", ["staple", "struggle"]],
  ["Carrots", 4, "each", "Produce", []],
  ["Green cabbage", 1, "head", "Produce", ["struggle"]],
  ["Soy sauce", 1, "bottle", "Oils & Condiments", ["flavor", "booster"]],
  ["White vinegar", 1, "bottle", "Oils & Condiments", ["flavor", "booster"]],
  ["Vegetable oil", 1, "bottle", "Oils & Condiments", ["staple"]],
  ["Peanut butter", 1, "jar", "Proteins", ["struggle", "flavor"]],
  ["Chili flakes", 1, "jar", "Spices", ["flavor", "booster"]],
  ["Salt", 1, "box", "Spices", ["staple"]],
  ["Black pepper", 1, "jar", "Spices", ["staple"]],
  ["Flour tortillas", 10, "each", "Grains", []],
  ["Cheddar cheese", 8, "oz", "Dairy", []],
];

export const DEMO_PANTRY_STORAGE_KEY = "ff_demo_pantry_v1";
export const DEMO_PANTRY_LABEL = "Demo pantry";

export function demoPantryFixture(): DemoPantryItem[] {
  return SEED.map(([name, quantity, unit, category, tags], i) => ({
    id: `demo-${i + 1}`,
    name,
    quantity,
    unit,
    category,
    tags: [...tags],
    barcode: null,
    expirationDate: null,
    nutritionJson: null,
    imageUrl: null,
  }));
}

function cleanItem(raw: unknown): DemoPantryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
  const quantity = Number(r.quantity);
  if (!name || !Number.isFinite(quantity) || quantity < 0) return null;
  const str = (v: unknown, max = 200) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  return {
    id: str(r.id, 64) ?? `demo-x-${Math.random().toString(36).slice(2, 10)}`,
    name,
    quantity,
    unit: str(r.unit, 40) ?? "each",
    category: str(r.category, 60),
    tags: Array.isArray(r.tags)
      ? r.tags.filter((t): t is string => typeof t === "string").slice(0, 20)
      : [],
    barcode: str(r.barcode, 32),
    expirationDate: str(r.expirationDate, 40),
    nutritionJson: str(r.nutritionJson, 4000),
    imageUrl: str(r.imageUrl, 2000),
  };
}

/** Parse stored JSON; falls back to the fixture when missing or corrupt. */
export function parseDemoPantry(raw: string | null | undefined): DemoPantryItem[] {
  if (raw == null) return demoPantryFixture();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return demoPantryFixture();
    return parsed.map(cleanItem).filter((x): x is DemoPantryItem => !!x).slice(0, 300);
  } catch {
    return demoPantryFixture();
  }
}

let counter = 0;
function newId() {
  counter += 1;
  return `demo-u-${Date.now().toString(36)}-${counter}`;
}

/** Add or merge (same barcode, else same normalized name + unit). */
export function addDemoItem(
  items: DemoPantryItem[],
  input: DemoPantryInput
): { items: DemoPantryItem[]; item: DemoPantryItem; merged: boolean } {
  const barcode = input.barcode?.replace(/\D/g, "") || null;
  const target = normalizeName(input.name);
  const existing =
    (barcode && items.find((i) => i.barcode === barcode)) ||
    items.find(
      (i) =>
        normalizeName(i.name) === target &&
        i.unit.toLowerCase() === input.unit.toLowerCase()
    );
  if (existing) {
    const merged: DemoPantryItem = {
      ...existing,
      quantity: existing.quantity + input.quantity,
      category: input.category ?? existing.category,
      ...(input.tags ? { tags: input.tags } : {}),
      barcode: existing.barcode ?? barcode,
      imageUrl: existing.imageUrl ?? input.imageUrl ?? null,
      nutritionJson: existing.nutritionJson ?? input.nutritionJson ?? null,
    };
    return {
      items: items.map((i) => (i.id === existing.id ? merged : i)),
      item: merged,
      merged: true,
    };
  }
  const item = cleanItem({ ...input, id: newId(), barcode })!;
  return { items: [...items, item], item, merged: false };
}

export function updateDemoItem(
  items: DemoPantryItem[],
  id: string,
  patch: Partial<DemoPantryInput>
): DemoPantryItem[] {
  return items.map((i) => {
    if (i.id !== id) return i;
    const next = cleanItem({ ...i, ...patch, id: i.id });
    return next ?? i;
  });
}

export function removeDemoItem(items: DemoPantryItem[], id: string): DemoPantryItem[] {
  return items.filter((i) => i.id !== id);
}

/** Shape sent to the read-only calculation endpoints. */
export function toCalcPantry(items: DemoPantryItem[]) {
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    category: i.category,
    tags: i.tags,
  }));
}
