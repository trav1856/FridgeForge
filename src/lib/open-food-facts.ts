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
};

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
      "User-Agent": "FridgeForge/0.1 (pantry-intake; local-dev)",
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
  const name =
    p.product_name_en ||
    p.product_name ||
    p.generic_name ||
    p.brands ||
    undefined;

  if (!name) {
    return { found: false, barcode: cleaned };
  }

  return {
    found: true,
    barcode: cleaned,
    name: name.trim(),
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
