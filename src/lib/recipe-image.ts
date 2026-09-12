import type * as cheerio from "cheerio";

/** Local branded fallback — UI never looks empty. */
export const RECIPE_PLACEHOLDER_PATH = "/recipe-images/placeholder.svg";

/**
 * Image strategy (import + seeds):
 * 1. Scraped from page: JSON-LD Recipe.image → og:image → twitter:image → large <img>
 * 2. TheMealDB search (free, no key) — deterministic keyword from title → strMealThumb
 * 3. Branded SVG at /recipe-images/placeholder.svg
 *
 * We store remote URLs on Recipe.imageUrl (no local download required).
 * Seed/import cache the TheMealDB thumb at write time. Foodish CDN is down;
 * never use Lorem Flickr.
 */

/** @deprecated Foodish CDN is often suspended; kept for tests/legacy only. */
export const FOODISH_IMAGE_COUNTS: Record<string, number> = {
  biryani: 81,
  burger: 87,
  "butter-chicken": 22,
  dessert: 36,
  dosa: 83,
  idly: 77,
  pasta: 34,
  pizza: 95,
  rice: 35,
  samosa: 22,
};

/** Curated title → TheMealDB search keyword for stable seed images. */
export const MEALDB_TITLE_KEYWORDS: Record<string, string> = {
  "Garlic Fried Rice with Crispy Egg": "fried rice",
  "Smoky Beans & Rice Bowl": "bean",
  "Pantry Tuna Pasta": "tuna",
  "Crispy Potato Hash with Eggs": "potato",
  "Peanut-Cabbage Noodle Stir": "noodle",
  "Cheesy Egg Tortilla Melts": "Egg Foo Young",
  "Carrot-Onion Tomato Soup": "soup",
  "Lemon-Garlic Butter Pasta": "carbonara",
  "Classic Apple Pie": "apple pie",
  "Scrambled Eggs": "egg",
  "Boiled / Steamed Rice": "rice",
  "Spaghetti with Simple Tomato Sauce": "spaghetti",
  "Grilled Cheese": "sandwich",
  "Simple Chicken Soup": "chicken soup",
  "Pancakes": "pancake",
  "Basic Roast Chicken": "roast chicken",
  "Mashed Potatoes": "potato",
  "Chocolate Chip Cookies": "cookie",
  "Veg & Protein Stir-Fry": "Thai beef stir-fry",
  "Chili / Taco Filling": "chili",
  "Banana Bread": "banana",
};

/**
 * Local / curated image paths that beat TheMealDB when the API returns a wrong dish
 * (e.g. "cookie" → Peanut Butter Cookies thumb for Chocolate Chip Cookies).
 */
export const LOCAL_RECIPE_IMAGES: Record<string, string> = {
  "Banana Bread": "/recipe-images/banana-bread.jpg",
  "Basic Roast Chicken": "/recipe-images/basic-roast-chicken.jpg",
  "Boiled / Steamed Rice": "/recipe-images/boiled-steamed-rice.jpg",
  "Carrot-Onion Tomato Soup": "/recipe-images/carrot-onion-tomato-soup.jpg",
  "Cheesy Egg Tortilla Melts": "/recipe-images/cheesy-egg-tortilla-melts.jpg",
  "Chili / Taco Filling": "/recipe-images/chili-taco-filling.jpg",
  "Chocolate Chip Cookies": "/recipe-images/chocolate-chip-cookies.jpg",
  "Classic Apple Pie": "/recipe-images/classic-apple-pie.jpg",
  "Crispy Potato Hash with Eggs": "/recipe-images/crispy-potato-hash-eggs.jpg",
  "Garlic Fried Rice with Crispy Egg": "/recipe-images/garlic-fried-rice-crispy-egg.jpg",
  "Grilled Cheese": "/recipe-images/grilled-cheese.jpg",
  "Lemon-Garlic Butter Pasta": "/recipe-images/lemon-garlic-butter-pasta.jpg",
  "Lo Mein Noodles": "/recipe-images/lo-mein-noodles.jpg",
  "Mashed Potatoes": "/recipe-images/mashed-potatoes.jpg",
  "Pancakes": "/recipe-images/pancakes.jpg",
  "Pantry Tuna Pasta": "/recipe-images/pantry-tuna-pasta.jpg",
  "Peanut-Cabbage Noodle Stir": "/recipe-images/peanut-cabbage-noodle-stir.jpg",
  "Scrambled Eggs": "/recipe-images/scrambled-eggs.jpg",
  "Simple Chicken Soup": "/recipe-images/simple-chicken-soup.jpg",
  "Smoky Beans & Rice Bowl": "/recipe-images/smoky-beans-rice-bowl.jpg",
  "Spaghetti with Simple Tomato Sauce": "/recipe-images/spaghetti-tomato-sauce.jpg",
  "Tomato Basil Grilled Cheese": "/recipe-images/tomato-basil-grilled-cheese.jpg",
  "Veg & Protein Stir-Fry": "/recipe-images/veg-protein-stir-fry.jpg",
};

/** Known wrong TheMealDB thumbs we should never keep (Peanut Butter Cookies image). */
export const KNOWN_WRONG_MEALDB_URLS = [
  "https://www.themealdb.com/images/media/meals/1544384070.jpg",
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "with",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "simple",
  "basic",
  "classic",
  "easy",
  "quick",
  "best",
  "homemade",
  "style",
]);

function absoluteUrl(src: string, baseUrl: string): string | null {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

function firstImageFromJsonLdField(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image.trim() || null;
  if (Array.isArray(image)) {
    for (const item of image) {
      const found = firstImageFromJsonLdField(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof image === "object") {
    const obj = image as { url?: string; contentUrl?: string; "@id"?: string };
    const u = obj.url || obj.contentUrl || obj["@id"];
    return typeof u === "string" && u.trim() ? u.trim() : null;
  }
  return null;
}

function isRecipeNode(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const t = (data as { "@type"?: string | string[] })["@type"];
  if (!t) return false;
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => String(x).toLowerCase().includes("recipe"));
}

/** Extract best recipe image URL from parsed HTML (relative → absolute). */
export function extractRecipeImage(
  $: cheerio.CheerioAPI,
  pageUrl: string
): string | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;
    try {
      let data = JSON.parse(raw);
      if (Array.isArray(data)) data = data.find((d) => isRecipeNode(d)) ?? data[0];
      if (data?.["@graph"]) {
        data = data["@graph"].find((d: unknown) => isRecipeNode(d)) ?? data;
      }
      if (isRecipeNode(data)) {
        const fromLd = firstImageFromJsonLdField(data.image);
        if (fromLd) {
          const abs = absoluteUrl(fromLd, pageUrl);
          if (abs) return abs;
        }
      }
    } catch {
      // next script
    }
  }

  const og =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content") ||
    $('meta[name="og:image"]').attr("content");
  if (og?.trim()) {
    const abs = absoluteUrl(og.trim(), pageUrl);
    if (abs) return abs;
  }

  const tw =
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[property="twitter:image"]').attr("content") ||
    $('meta[name="twitter:image:src"]').attr("content");
  if (tw?.trim()) {
    const abs = absoluteUrl(tw.trim(), pageUrl);
    if (abs) return abs;
  }

  const imgs = $("article img, .recipe img, main img, img").toArray();
  let best: { src: string; score: number } | null = null;
  for (const el of imgs) {
    const $el = $(el);
    const src =
      $el.attr("src") ||
      $el.attr("data-src") ||
      $el.attr("data-lazy-src") ||
      "";
    if (!src || src.startsWith("data:")) continue;
    const lower = src.toLowerCase();
    if (
      lower.includes("avatar") ||
      lower.includes("logo") ||
      lower.includes("icon") ||
      lower.includes("sprite") ||
      lower.includes("1x1") ||
      lower.includes("pixel")
    ) {
      continue;
    }
    const w = Number($el.attr("width")) || 0;
    const h = Number($el.attr("height")) || 0;
    const score = w * h || (lower.includes("recipe") ? 50000 : 1000);
    if (w && h && (w < 100 || h < 100)) continue;
    if (!best || score > best.score) {
      const abs = absoluteUrl(src, pageUrl);
      if (abs) best = { src: abs, score };
    }
  }
  return best?.src ?? null;
}

/** @deprecated Prefer mealDbSearchKeyword / TheMealDB. */
export function foodishCategoryForTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(soup|stew|chowder|bisque|salad|coleslaw)\b/.test(t)) return null;
  if (
    /\b(fish|salmon|tuna|seafood|shrimp|cod)\b/.test(t) &&
    !/\b(pasta|pizza|burger|rice)\b/.test(t)
  ) {
    return null;
  }
  if (
    /\b(bread|loaf|baguette|biscuit)\b/.test(t) &&
    !/\b(banana bread|zucchini bread|pumpkin bread)\b/.test(t)
  ) {
    return null;
  }

  const map: [RegExp, string][] = [
    [/pizza/, "pizza"],
    [/burger|sandwich|grilled cheese/, "burger"],
    [/pasta|spaghetti|noodle|macaroni|\bmac\b/, "pasta"],
    [/biryani/, "biryani"],
    [/rice|fried rice|rice bowl/, "rice"],
    [
      /apple pie|pie|dessert|cake|cookie|brownie|pudding|pancake|cupcake|ice[\s-]?cream|banana bread|zucchini bread|pumpkin bread/,
      "dessert",
    ],
    [/dosa/, "dosa"],
    [/idli|idly/, "idly"],
    [/samosa/, "samosa"],
    [
      /butter chicken|curry|chicken|chili|chilli|taco|steak|meat|beef|pork|roast|lamb/,
      "butter-chicken",
    ],
    [/egg|breakfast|omelet|omelette|brunch|scramble/, "dosa"],
    [/stir[\s-]?fry|stirfry/, "rice"],
  ];
  for (const [re, cat] of map) {
    if (re.test(t)) return cat;
  }
  return null;
}

/** Stable 32-bit hash for deterministic image index. */
export function hashTitle(title: string): number {
  let h = 2166136261;
  for (let i = 0; i < title.length; i++) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a TheMealDB search keyword from a recipe title (deterministic).
 */
export function mealDbSearchKeyword(title: string): string {
  const curated = MEALDB_TITLE_KEYWORDS[title];
  if (curated) return curated;

  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned
    .split(" ")
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  if (tokens.length === 0) return cleaned.split(" ")[0] || "chicken";

  const preferred = tokens.find((t) =>
    /^(pie|pasta|soup|rice|noodle|noodles|chicken|beef|potato|pancake|cookie|chili|taco|stir|fry|salad|curry|egg|eggs|bread|cake|stew|hash)$/.test(
      t
    )
  );
  if (preferred) return preferred;

  if (tokens.length >= 2) return `${tokens[0]} ${tokens[1]}`;
  return tokens[0]!;
}

type MealDbMeal = { strMeal?: string; strMealThumb?: string; idMeal?: string };

/**
 * Search TheMealDB and return a deterministic strMealThumb for the title.
 * Free, no API key: https://www.themealdb.com/api.php
 */
export async function fetchMealDbImage(title: string): Promise<string | null> {
  const keyword = mealDbSearchKeyword(title);
  if (!keyword.trim()) return null;

  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(
    keyword
  )}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { meals?: MealDbMeal[] | null };
    const meals = data.meals;
    if (!meals || meals.length === 0) return null;
    const idx = hashTitle(title) % meals.length;
    const thumb = meals[idx]?.strMealThumb?.trim();
    return thumb || null;
  } catch {
    return null;
  }
}

/**
 * Sync fallback for callers that cannot await — always the branded SVG.
 * Real photos are resolved async via resolveRecipeImageUrl / fetchMealDbImage
 * and cached on Recipe.imageUrl at seed/import time.
 */
export function deterministicFoodImageUrl(_title: string): string {
  return RECIPE_PLACEHOLDER_PATH;
}

/** @deprecated Foodish CDN often 503s. */
export function foodishCdnUrl(title: string): string | null {
  const category = foodishCategoryForTitle(title);
  if (!category) return null;
  const count = FOODISH_IMAGE_COUNTS[category];
  if (!count) return null;
  const n = (hashTitle(title) % count) + 1;
  return `https://foodish-api.com/images/${category}/${category}${n}.jpg`;
}

/** @deprecated Prefer fetchMealDbImage. */
export async function fetchFoodishImage(
  title?: string
): Promise<string | null> {
  const category = title ? foodishCategoryForTitle(title) : null;
  if (!category) return null;
  const url = `https://foodish-api.com/api/images/${category}/`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { image?: string };
    if (data.image && typeof data.image === "string") return data.image;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Resolve final image URL:
 * scraped → TheMealDB search (deterministic) → branded placeholder.
 * Seeds should await this once and store imageUrl.
 */
export async function resolveRecipeImageUrl(opts: {
  title: string;
  scrapedImageUrl?: string | null;
  preferDeterministicFallback?: boolean;
}): Promise<string> {
  if (opts.scrapedImageUrl?.trim()) return opts.scrapedImageUrl.trim();

  const local = LOCAL_RECIPE_IMAGES[opts.title];
  if (local) return local;

  const mealDb = await fetchMealDbImage(opts.title);
  if (mealDb && !KNOWN_WRONG_MEALDB_URLS.includes(mealDb)) return mealDb;

  void opts.preferDeterministicFallback;
  return local || RECIPE_PLACEHOLDER_PATH;
}

/** True when stored URL is missing or still a junk/placeholder CDN. */
export function needsMealDbImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl || !imageUrl.trim()) return true;
  if (imageUrl === RECIPE_PLACEHOLDER_PATH) return true;
  if (imageUrl.includes("placeholder.svg")) return true;
  if (imageUrl.includes("foodish-api.com")) return true;
  if (imageUrl.includes("loremflickr")) return true;
  if (KNOWN_WRONG_MEALDB_URLS.some((u) => imageUrl.includes("1544384070"))) return true;
  return false;
}

/** Admin/UI: recipe has a real photo path/URL (not empty/placeholder/junk). */
export function hasRecipePhoto(imageUrl: string | null | undefined): boolean {
  return !needsMealDbImage(imageUrl);
}
