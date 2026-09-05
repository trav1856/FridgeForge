export const PANTRY_CATEGORIES = [
  "Grains",
  "Proteins",
  "Produce",
  "Dairy",
  "Canned",
  "Spices",
  "Oils & Condiments",
  "Other",
] as const;

export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];

/** Map Open Food Facts category tags / text to FridgeForge categories. */
export function suggestCategoryFromOff(
  categoriesTags: string[] = [],
  categoriesText = ""
): PantryCategory {
  const blob = [...categoriesTags, categoriesText].join(" ").toLowerCase();

  const rules: [RegExp, PantryCategory][] = [
    [/\b(rice|pasta|noodle|grain|cereal|flour|bread|oat)\b/, "Grains"],
    [/\b(meat|poultry|chicken|beef|pork|fish|seafood|egg|tofu|bean|lentil|protein)\b/, "Proteins"],
    [/\b(fruit|vegetable|produce|salad|herb|fresh)\b/, "Produce"],
    [/\b(dairy|milk|cheese|yogurt|butter|cream)\b/, "Dairy"],
    [/\b(canned|tinned|preserve)\b/, "Canned"],
    [/\b(spice|seasoning|salt|pepper|herb.?dry)\b/, "Spices"],
    [/\b(oil|vinegar|sauce|condiment|dressing|mayo|ketchup|mustard|soy)\b/, "Oils & Condiments"],
  ];

  for (const [re, cat] of rules) {
    if (re.test(blob)) return cat;
  }
  return "Other";
}

export function suggestUnitFromOff(quantityField?: string | null): string {
  if (!quantityField) return "each";
  const q = quantityField.toLowerCase();
  if (/\bml\b|\bl\b|liter|litre|fl\s*oz/.test(q)) return "ml";
  if (/\bg\b|gram|kg|ounce|oz\b|lb\b/.test(q)) return "g";
  if (/\bcan|tin\b/.test(q)) return "cans";
  if (/\bpack|pkg|box\b/.test(q)) return "pack";
  return "each";
}
