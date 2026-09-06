import {
  suggestCategoryFromOff,
  suggestUnitFromOff,
  type PantryCategory,
} from "./categories";

export type BarcodeLookupResult = {
  found: boolean;
  barcode: string;
  name?: string;
  brand?: string | null;
  quantityHint?: string | null;
  suggestedCategory?: PantryCategory;
  suggestedUnit?: string;
  imageUrl?: string | null;
  rawCategories?: string | null;
};

/** Compact nutrition snapshot stored as PantryItem.nutritionJson */
export type NutritionSnapshot = {
  caloriesPer100g?: number | null;
  proteinPer100g?: number | null;
  fatPer100g?: number | null;
  carbsPer100g?: number | null;
  productName?: string | null;
  source: "openfoodfacts";
};

type OffNutriments = {
  "energy-kcal_100g"?: number;
  energy_kcal_100g?: number;
  "energy-kcal"?: number;
  proteins_100g?: number;
  fat_100g?: number;
  carbohydrates_100g?: number;
};

type OffProduct = {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  categories?: string;
  categories_tags?: string[];
  image_front_small_url?: string;
  image_url?: string;
  nutriments?: OffNutriments;
};

const OFF_UA = "FridgeForge/0.1 (pantry-intake; local-dev)";

function pickName(p: OffProduct): string | undefined {
  const name =
    p.product_name_en ||
    p.product_name ||
    p.generic_name ||
    p.brands ||
    undefined;
  return name?.trim() || undefined;
}

function numOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

/** Extract per-100g macros from an OFF product when present. */
export function nutritionFromOffProduct(
  p: OffProduct
): NutritionSnapshot | null {
  const n = p.nutriments;
  if (!n) return null;
  const calories =
    numOrNull(n["energy-kcal_100g"]) ??
    numOrNull(n.energy_kcal_100g) ??
    numOrNull(n["energy-kcal"]);
  const protein = numOrNull(n.proteins_100g);
  const fat = numOrNull(n.fat_100g);
  const carbs = numOrNull(n.carbohydrates_100g);
  if (calories == null && protein == null && fat == null && carbs == null) {
    return null;
  }
  return {
    caloriesPer100g: calories,
    proteinPer100g: protein,
    fatPer100g: fat,
    carbsPer100g: carbs,
    productName: pickName(p) ?? null,
    source: "openfoodfacts",
  };
}

export function parseNutritionJson(
  raw: string | null | undefined
): NutritionSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NutritionSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatNutritionBlurb(
  raw: string | null | undefined
): string | null {
  const n = parseNutritionJson(raw);
  if (!n) return null;
  const parts: string[] = [];
  if (n.caloriesPer100g != null) parts.push(`${n.caloriesPer100g} kcal`);
  if (n.proteinPer100g != null) parts.push(`P ${n.proteinPer100g}g`);
  if (n.fatPer100g != null) parts.push(`F ${n.fatPer100g}g`);
  if (n.carbsPer100g != null) parts.push(`C ${n.carbsPer100g}g`);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} /100g`;
}

export async function lookupOpenFoodFacts(
  barcode: string
): Promise<BarcodeLookupResult> {
  const cleaned = barcode.replace(/\D/g, "");
  if (!cleaned || cleaned.length < 8) {
    return { found: false, barcode: cleaned || barcode };
  }

  const url = `https://world.openfoodfacts.org/api/v2/product/${cleaned}.json`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": OFF_UA,
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return { found: false, barcode: cleaned };
  }

  const data = (await res.json()) as {
    status?: number;
    product?: OffProduct;
  };

  if (data.status !== 1 || !data.product) {
    return { found: false, barcode: cleaned };
  }

  const p = data.product;
  const name = pickName(p);

  if (!name) {
    return { found: false, barcode: cleaned };
  }

  return {
    found: true,
    barcode: cleaned,
    name,
    brand: p.brands?.trim() || null,
    quantityHint: p.quantity || null,
    suggestedCategory: suggestCategoryFromOff(
      p.categories_tags || [],
      p.categories || ""
    ),
    suggestedUnit: suggestUnitFromOff(p.quantity),
    imageUrl: p.image_front_small_url || p.image_url || null,
    rawCategories: p.categories || null,
  };
}

/**
 * Best-effort name search for nutrition (and optional hints).
 * Returns null when nothing useful is found — callers must not block on this.
 */
export async function searchNutritionByName(
  name: string
): Promise<NutritionSnapshot | null> {
  const q = name.trim();
  if (!q || q.length < 2) return null;

  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", q);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "5");
    url.searchParams.set(
      "fields",
      "product_name,product_name_en,generic_name,brands,nutriments,categories,categories_tags"
    );

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": OFF_UA,
        Accept: "application/json",
      },
      // Avoid Next caching failed/empty searches forever
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { products?: OffProduct[] };
    const products = data.products || [];
    const needle = q.toLowerCase();

    // Prefer a product whose name loosely matches and has nutriments
    const ranked = [...products].sort((a, b) => {
      const an = (pickName(a) || "").toLowerCase();
      const bn = (pickName(b) || "").toLowerCase();
      const as = an.includes(needle) || needle.includes(an.split(" ")[0] || "") ? 0 : 1;
      const bs = bn.includes(needle) || needle.includes(bn.split(" ")[0] || "") ? 0 : 1;
      const anut = a.nutriments ? 0 : 1;
      const bnut = b.nutriments ? 0 : 1;
      return as - bs || anut - bnut;
    });

    for (const p of ranked) {
      const snap = nutritionFromOffProduct(p);
      if (snap) return snap;
    }
    return null;
  } catch {
    return null;
  }
}

/** Serialize nutrition for DB; null if empty. */
export function stringifyNutrition(
  snap: NutritionSnapshot | null | undefined
): string | null {
  if (!snap) return null;
  try {
    return JSON.stringify(snap);
  } catch {
    return null;
  }
}
