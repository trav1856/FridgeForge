/**
 * Fallback emoji / label for pantry rows when no OFF product image is stored.
 * Never leave a blank thumb — always return something.
 */

export type PantryIcon = {
  emoji: string;
  label: string;
};

const CATEGORY_ICONS: Record<string, PantryIcon> = {
  Grains: { emoji: "🌾", label: "Grains" },
  Proteins: { emoji: "🥩", label: "Proteins" },
  Produce: { emoji: "🥬", label: "Produce" },
  Dairy: { emoji: "🧀", label: "Dairy" },
  Canned: { emoji: "🥫", label: "Canned" },
  Spices: { emoji: "🧂", label: "Spices" },
  "Oils & Condiments": { emoji: "🫒", label: "Oils & Condiments" },
  Baking: { emoji: "🧁", label: "Baking" },
  Other: { emoji: "🧺", label: "Other" },
};

const NAME_RULES: { test: RegExp; icon: PantryIcon }[] = [
  { test: /\b(candy|gummy|nerd|chocolate|cookie|snack|chip)\b/i, icon: { emoji: "🍬", label: "Snack" } },
  { test: /\b(milk|cheese|yogurt|butter|cream)\b/i, icon: { emoji: "🧀", label: "Dairy" } },
  { test: /\b(egg)\b/i, icon: { emoji: "🥚", label: "Eggs" } },
  { test: /\b(rice|pasta|noodle|bread|tortilla|oat)\b/i, icon: { emoji: "🍞", label: "Grains" } },
  { test: /\b(chicken|beef|pork|fish|tuna|meat)\b/i, icon: { emoji: "🥩", label: "Protein" } },
  { test: /\b(apple|banana|onion|garlic|potato|carrot|cabbage|tomato)\b/i, icon: { emoji: "🥕", label: "Produce" } },
  { test: /\b(oil|sauce|vinegar|mayo|ketchup|mustard|soy)\b/i, icon: { emoji: "🫙", label: "Condiment" } },
  { test: /\b(flour|sugar|yeast|baking)\b/i, icon: { emoji: "🧁", label: "Baking" } },
  { test: /\b(unknown product|upc)\b/i, icon: { emoji: "📦", label: "Unknown" } },
];

/** Pick a never-blank icon from category and/or product name. */
export function pantryIconFor(opts: {
  name?: string | null;
  category?: string | null;
}): PantryIcon {
  const name = opts.name || "";
  for (const rule of NAME_RULES) {
    if (rule.test.test(name)) return rule.icon;
  }
  const cat = (opts.category || "Other").trim();
  return CATEGORY_ICONS[cat] || CATEGORY_ICONS.Other;
}
