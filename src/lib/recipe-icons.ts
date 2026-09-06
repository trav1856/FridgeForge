/**
 * Small obvious cuisine/ingredient icons for recipe cards.
 * Derived from title + tags + ingredient names. Cap 4–6.
 */

export type RecipeIcon = {
  id: string;
  emoji: string;
  label: string;
};

type IconRule = {
  id: string;
  emoji: string;
  label: string;
  /** Match against lowercased haystack */
  test: RegExp;
  /** Higher = prefer when capping */
  weight: number;
};

const RULES: IconRule[] = [
  { id: "noodles", emoji: "🍜", label: "Noodles / pasta", test: /\b(noodle|noodles|pasta|spaghetti|ramen|lo mein|udon|macaroni|\bmac\b|linguine|fettuccine)\b/, weight: 90 },
  { id: "rice", emoji: "🍚", label: "Rice", test: /\b(rice|risotto|biryani|fried rice)\b/, weight: 85 },
  { id: "potato", emoji: "🥔", label: "Potato", test: /\b(potato|potatoes|mash|hash)\b/, weight: 80 },
  { id: "egg", emoji: "🥚", label: "Egg", test: /\b(egg|eggs|omelet|omelette|scramble)\b/, weight: 80 },
  { id: "cheese", emoji: "🧀", label: "Cheese", test: /\b(cheese|cheddar|parmesan|mozzarella|grilled cheese)\b/, weight: 75 },
  { id: "chicken", emoji: "🍗", label: "Chicken", test: /\b(chicken)\b/, weight: 88 },
  { id: "meat", emoji: "🥩", label: "Meat", test: /\b(beef|pork|steak|lamb|meat|bacon|sausage|chili|taco filling|ground)\b/, weight: 82 },
  { id: "seafood", emoji: "🐟", label: "Seafood", test: /\b(fish|tuna|salmon|shrimp|seafood|cod|crab)\b/, weight: 85 },
  { id: "veg", emoji: "🥬", label: "Vegetables", test: /\b(vegetable|veg|cabbage|carrot|broccoli|onion|pepper|celery|salad|produce|spinach|tomato)\b/, weight: 60 },
  { id: "garlic", emoji: "🧄", label: "Garlic", test: /\b(garlic)\b/, weight: 70 },
  { id: "spicy", emoji: "🌶️", label: "Spicy", test: /\b(spicy|chili|chilli|pepper flake|hot sauce|cayenne|sriracha|chipotle|jalapeño|jalapeno)\b/, weight: 78 },
  { id: "soup", emoji: "🍲", label: "Soup", test: /\b(soup|stew|broth|chowder)\b/, weight: 75 },
  { id: "bread", emoji: "🍞", label: "Bread", test: /\b(bread|toast|sandwich|tortilla|bun)\b/, weight: 65 },
  { id: "dessert", emoji: "🍪", label: "Sweet / dessert", test: /\b(cookie|cookies|cake|pie|dessert|sweet|pancake|banana bread|chocolate|baking)\b/, weight: 72 },
  { id: "beans", emoji: "🫘", label: "Beans", test: /\b(bean|beans|lentil|chickpea)\b/, weight: 70 },
  { id: "mexican", emoji: "🌮", label: "Mexican / taco", test: /\b(mexican|taco|burrito|salsa|enchilada)\b/, weight: 77 },
  { id: "italian", emoji: "🇮🇹", label: "Italian", test: /\b(italian|pizza|marinara|pesto)\b/, weight: 70 },
  { id: "asian", emoji: "🥢", label: "Asian", test: /\b(chinese|asian|soy|stir[\s-]?fry|teriyaki|korean|japanese|thai)\b/, weight: 68 },
  { id: "indian", emoji: "🍛", label: "Indian / curry", test: /\b(indian|curry|masala|tikka|dal)\b/, weight: 76 },
  { id: "bbq", emoji: "🔥", label: "BBQ", test: /\b(bbq|barbecue|grill|smoky)\b/, weight: 74 },
  { id: "seafood_shell", emoji: "🦐", label: "Shellfish", test: /\b(shrimp|prawn|lobster|clam|mussel)\b/, weight: 84 },
];

const MAX_ICONS = 6;

export function recipeIconsFrom(opts: {
  title?: string | null;
  tags?: string[] | null;
  ingredients?: { name: string }[] | string[] | null;
  description?: string | null;
  flavorBoosters?: string[] | null;
}): RecipeIcon[] {
  const parts: string[] = [];
  if (opts.title) parts.push(opts.title);
  if (opts.description) parts.push(opts.description);
  if (opts.tags) parts.push(...opts.tags);
  if (opts.flavorBoosters) parts.push(...opts.flavorBoosters);
  if (opts.ingredients) {
    for (const i of opts.ingredients) {
      parts.push(typeof i === "string" ? i : i.name);
    }
  }
  const hay = parts.join(" ").toLowerCase();

  const hits: { rule: IconRule }[] = [];
  for (const rule of RULES) {
    if (rule.test.test(hay)) hits.push({ rule });
  }

  // Prefer chicken over generic meat when both match
  const ids = new Set(hits.map((h) => h.rule.id));
  let filtered = hits;
  if (ids.has("chicken")) {
    filtered = filtered.filter((h) => h.rule.id !== "meat");
  }
  if (ids.has("seafood_shell")) {
    filtered = filtered.filter((h) => h.rule.id !== "seafood");
  }

  filtered.sort((a, b) => b.rule.weight - a.rule.weight);

  const seen = new Set<string>();
  const out: RecipeIcon[] = [];
  for (const { rule } of filtered) {
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    out.push({ id: rule.id, emoji: rule.emoji, label: rule.label });
    if (out.length >= MAX_ICONS) break;
  }
  return out;
}
