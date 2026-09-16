/**
 * Curated generic pantry product photos (static WebP under
 * public/pantry-images/generic/). Brand-specific images come from
 * Open Food Facts and are stored on PantryItem.imageUrl when scanned
 * or when a non-staple branded name resolves via OFF search.
 *
 * Licensing: see public/pantry-images/generic/CREDITS.md — photos are
 * Wikimedia Commons (PD / CC) or Unsplash License; not scraped brand art.
 */

const GENERIC_BASE = "/pantry-images/generic";

/** Exact catalog / common staple name → static asset path. */
const EXACT_GENERIC: Record<string, string> = {
  milk: "milk",
  "gallon of whole milk": "milk",
  "whole milk": "milk",
  "2% milk": "milk",
  "skim milk": "milk",
  eggs: "eggs",
  egg: "eggs",
  butter: "butter",
  margarine: "butter",
  "cheddar cheese": "cheese",
  mozzarella: "cheese",
  parmesan: "cheese",
  cheese: "cheese",
  yogurt: "yogurt",
  "cream cheese": "dairy",
  "sour cream": "dairy",
  "white rice": "rice",
  "brown rice": "rice",
  rice: "rice",
  spaghetti: "pasta",
  "penne pasta": "pasta",
  pasta: "pasta",
  bread: "bread",
  "flour tortillas": "tortilla",
  tortilla: "tortilla",
  oats: "oats",
  flour: "flour",
  sugar: "sugar",
  "brown sugar": "sugar",
  "powdered sugar": "sugar",
  "ground beef": "beef",
  beef: "beef",
  "chicken breast": "chicken",
  "chicken thighs": "chicken",
  "whole chicken": "chicken",
  chicken: "chicken",
  bacon: "pork",
  "pork chops": "pork",
  "ground turkey": "chicken",
  "canned tuna": "fish",
  tuna: "fish",
  "peanut butter": "peanut-butter",
  "black beans (dry)": "beans",
  "canned black beans": "beans",
  "canned chickpeas": "beans",
  tofu: "tofu",
  "yellow onion": "onion",
  onion: "onion",
  garlic: "garlic",
  potato: "potato",
  potatoes: "potato",
  carrot: "carrot",
  carrots: "carrot",
  celery: "produce",
  "bell pepper": "pepper",
  tomato: "tomato",
  broccoli: "broccoli",
  spinach: "spinach",
  lettuce: "lettuce",
  cabbage: "lettuce",
  "green cabbage": "lettuce",
  zucchini: "produce",
  cucumber: "produce",
  mushrooms: "mushroom",
  apple: "apple",
  banana: "banana",
  orange: "orange",
  lemon: "lemon",
  lime: "lemon",
  grapes: "berries",
  berries: "berries",
  strawberries: "berries",
  avocado: "avocado",
  "canned diced tomatoes": "canned",
  "tomato sauce": "canned",
  "canned corn": "canned",
  "canned green beans": "canned",
  "chicken broth": "broth",
  "coconut milk": "canned",
  "olive oil": "oil",
  "vegetable oil": "oil",
  "soy sauce": "soy-sauce",
  "white vinegar": "vinegar",
  ketchup: "ketchup",
  mustard: "mustard",
  mayonnaise: "mayo",
  "hot sauce": "spice",
  honey: "honey",
  salt: "salt",
  "black pepper": "pepper-spice",
  "garlic powder": "spice",
  paprika: "spice",
  cumin: "spice",
  "chili flakes": "spice",
  oregano: "spice",
  cinnamon: "spice",
  "bay leaves": "spice",
  "baking powder": "baking",
  "baking soda": "baking",
  "chocolate chips": "chocolate",
  cornstarch: "baking",
  yeast: "baking",
  "cocoa powder": "chocolate",
  "vanilla extract": "baking",
  cornmeal: "grains",
  breadcrumbs: "grains",
  "broth cubes": "broth",
};

/** Keyword → slug (first match wins; longer / more specific first). */
const KEYWORD_GENERIC: { test: RegExp; slug: string }[] = [
  { test: /\b(peanut\s*butter)\b/i, slug: "peanut-butter" },
  { test: /\b(soy\s*sauce)\b/i, slug: "soy-sauce" },
  { test: /\b(hot\s*sauce)\b/i, slug: "spice" },
  { test: /\b(cream\s*cheese|sour\s*cream)\b/i, slug: "dairy" },
  { test: /\b(chocolate)\b/i, slug: "chocolate" },
  { test: /\b(margarine|butter)\b/i, slug: "butter" },
  { test: /\b(milk|half[\s-]?and[\s-]?half)\b/i, slug: "milk" },
  { test: /\b(yogurt|yoghurt)\b/i, slug: "yogurt" },
  { test: /\b(cheese|cheddar|mozzarella|parmesan)\b/i, slug: "cheese" },
  { test: /\beggs?\b/i, slug: "eggs" },
  { test: /\b(rice)\b/i, slug: "rice" },
  { test: /\b(pasta|spaghetti|penne|noodle)\b/i, slug: "pasta" },
  { test: /\b(bread|bagel|bun)\b/i, slug: "bread" },
  { test: /\b(tortilla)\b/i, slug: "tortilla" },
  { test: /\b(oats?|oatmeal)\b/i, slug: "oats" },
  { test: /\b(flour)\b/i, slug: "flour" },
  { test: /\b(sugar)\b/i, slug: "sugar" },
  { test: /\b(chicken|turkey)\b/i, slug: "chicken" },
  { test: /\b(beef|steak|ground\s*beef)\b/i, slug: "beef" },
  { test: /\b(pork|bacon|ham)\b/i, slug: "pork" },
  { test: /\b(tuna|salmon|fish|shrimp)\b/i, slug: "fish" },
  { test: /\b(bean|lentil|chickpea)\b/i, slug: "beans" },
  { test: /\b(tofu)\b/i, slug: "tofu" },
  { test: /\b(onion)\b/i, slug: "onion" },
  { test: /\b(garlic)\b/i, slug: "garlic" },
  { test: /\b(potato)\b/i, slug: "potato" },
  { test: /\b(carrot)\b/i, slug: "carrot" },
  { test: /\b(tomato)\b/i, slug: "tomato" },
  { test: /\b(broccoli)\b/i, slug: "broccoli" },
  { test: /\b(spinach|kale)\b/i, slug: "spinach" },
  { test: /\b(lettuce|cabbage|salad)\b/i, slug: "lettuce" },
  { test: /\b(pepper|jalape[nñ]o)\b/i, slug: "pepper" },
  { test: /\b(mushroom)\b/i, slug: "mushroom" },
  { test: /\b(apple)\b/i, slug: "apple" },
  { test: /\b(banana)\b/i, slug: "banana" },
  { test: /\b(orange)\b/i, slug: "orange" },
  { test: /\b(lemon|lime)\b/i, slug: "lemon" },
  { test: /\b(avocado)\b/i, slug: "avocado" },
  { test: /\b(berr|grape|strawberr)\b/i, slug: "berries" },
  { test: /\b(olive\s*oil|vegetable\s*oil|canola|oil)\b/i, slug: "oil" },
  { test: /\b(vinegar)\b/i, slug: "vinegar" },
  { test: /\b(ketchup)\b/i, slug: "ketchup" },
  { test: /\b(mustard)\b/i, slug: "mustard" },
  { test: /\b(mayo|mayonnaise)\b/i, slug: "mayo" },
  { test: /\b(honey)\b/i, slug: "honey" },
  { test: /\b(salt)\b/i, slug: "salt" },
  { test: /\b(broth|stock)\b/i, slug: "broth" },
  { test: /\b(canned|can of)\b/i, slug: "canned" },
  { test: /\b(baking|yeast|cornstarch)\b/i, slug: "baking" },
];

const CATEGORY_GENERIC: Record<string, string> = {
  Dairy: "dairy",
  Produce: "produce",
  Proteins: "proteins",
  Grains: "grains",
  Canned: "canned",
  Baking: "baking",
  Spices: "spice",
  "Oils & Condiments": "oil",
  Other: "other",
};

function pathForSlug(slug: string): string {
  return `${GENERIC_BASE}/${slug}.webp`;
}

/** True when URL points at our curated generic assets. */
export function isGenericPantryImage(
  url: string | null | undefined
): boolean {
  if (!url) return false;
  return url.includes("/pantry-images/generic/");
}

/** True when URL looks like an OFF / remote brand product image. */
export function isBrandPantryImage(url: string | null | undefined): boolean {
  if (!url || isGenericPantryImage(url)) return false;
  return /^https?:\/\//i.test(url) || url.startsWith("/pantry-images/brand/");
}

/**
 * Curated generic photo for a pantry name (or null if only category
 * fallback would apply and category is unknown — callers may still
 * pass category for category fallback).
 */
export function genericPantryImageForName(
  name: string,
  category?: string | null
): string | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) {
    const catSlug = category ? CATEGORY_GENERIC[category] : null;
    return catSlug ? pathForSlug(catSlug) : null;
  }

  const exact = EXACT_GENERIC[key];
  if (exact) return pathForSlug(exact);

  for (const rule of KEYWORD_GENERIC) {
    if (rule.test.test(key)) return pathForSlug(rule.slug);
  }

  const catSlug = category ? CATEGORY_GENERIC[category] : null;
  if (catSlug) return pathForSlug(catSlug);

  return pathForSlug("other");
}

/**
 * Display URL for a pantry tile: stored brand/generic URL wins;
 * otherwise curated generic from name/category.
 */
export function resolvePantryImageUrl(opts: {
  name: string;
  imageUrl?: string | null;
  category?: string | null;
}): string | null {
  const stored = opts.imageUrl?.trim() || null;
  if (stored) {
    // Legacy generic SVG paths → WebP photos
    if (
      stored.includes("/pantry-images/generic/") &&
      stored.endsWith(".svg")
    ) {
      return stored.replace(/\.svg$/i, ".webp");
    }
    return stored;
  }
  return genericPantryImageForName(opts.name, opts.category);
}

/**
 * True for curated staples / plain commodity names that should show a
 * generic photo — not a random OFF brand carton. Branded names like
 * "Parkay Margarine" return false so OFF brand art + nutrition can win.
 */
export function prefersGenericPantryImage(name: string): boolean {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return false;
  if (EXACT_GENERIC[key]) return true;
  // Single-token commodity (milk, eggs, rice) → generic even if not exact map key casing variants
  if (!/\s/.test(key) && KEYWORD_GENERIC.some((r) => r.test.test(key))) {
    return true;
  }
  return false;
}
