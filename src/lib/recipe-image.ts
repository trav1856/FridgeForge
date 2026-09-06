import type * as cheerio from "cheerio";

/** Local branded fallback — UI never looks empty. */
export const RECIPE_PLACEHOLDER_PATH = "/recipe-images/placeholder.svg";

/**
 * Image strategy (import + seeds):
 * 1. Scraped from page: JSON-LD Recipe.image → og:image → twitter:image → large <img>
 * 2. Foodish — category API fetch, or deterministic CDN URL when category is known
 *    (https://foodish-api.com/images/{category}/{category}{n}.jpg)
 * 3. Branded SVG at /recipe-images/placeholder.svg
 *
 * We store remote URLs on Recipe.imageUrl (no local download required).
 * Seed recipes use deterministic Foodish CDN URLs keyed by title hash (or the
 * placeholder when no Foodish category matches). Never use Lorem Flickr.
 */

/** Known Foodish categories and image counts (1-based filenames). */
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

  // First reasonably large content image (skip icons / tracking pixels)
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

/**
 * Map recipe title → Foodish category folder name, or null when unknown.
 * Only returns categories that exist on Foodish (see FOODISH_IMAGE_COUNTS).
 * Unmapped dishes (soup, salad, plain bread, fish, etc.) intentionally yield
 * null so callers can use the branded placeholder instead of unrelated photos.
 */
export function foodishCategoryForTitle(title: string): string | null {
  const t = title.toLowerCase();

  // Dishes with no Foodish folder — prefer brand placeholder over a wrong dish.
  if (/\b(soup|stew|chowder|bisque|salad|coleslaw)\b/.test(t)) return null;
  if (/\b(fish|salmon|tuna|seafood|shrimp|cod)\b/.test(t) && !/\b(pasta|pizza|burger|rice)\b/.test(t)) {
    return null;
  }
  if (/\b(bread|loaf|baguette|biscuit)\b/.test(t) && !/\b(banana bread|zucchini bread|pumpkin bread)\b/.test(t)) {
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
 * Deterministic Foodish CDN URL for seeds (no API key).
 * Returns RECIPE_PLACEHOLDER_PATH when the title has no Foodish category —
 * better empty brand than random unrelated photos.
 */
export function deterministicFoodImageUrl(title: string): string {
  // Foodish CDN (foodish-api.com) is often suspended; never use Lorem Flickr.
  // Seeds/fallbacks use the branded skillet placeholder — real photos come from
  // scraped recipe pages when import succeeds.
  void title;
  return RECIPE_PLACEHOLDER_PATH;
}

/** Foodish CDN URL when the host is healthy (optional; may 503). */
export function foodishCdnUrl(title: string): string | null {
  const category = foodishCategoryForTitle(title);
  if (!category) return null;
  const count = FOODISH_IMAGE_COUNTS[category];
  if (!count) return null;
  const n = (hashTitle(title) % count) + 1;
  return `https://foodish-api.com/images/${category}/${category}${n}.jpg`;
}

/**
 * Fetch a category food image from Foodish — free, no key.
 * Only calls the category endpoint (no random /api/) so we never get an
 * unrelated dish when the title did not map to a category.
 * https://foodish-api.com/
 */
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
 * scraped → Foodish category fetch OR deterministic Foodish CDN → placeholder.
 * Seeds pass preferDeterministicFallback: true to skip the live API.
 */
export async function resolveRecipeImageUrl(opts: {
  title: string;
  scrapedImageUrl?: string | null;
  preferDeterministicFallback?: boolean;
}): Promise<string> {
  if (opts.scrapedImageUrl?.trim()) return opts.scrapedImageUrl.trim();

  if (opts.preferDeterministicFallback) {
    return deterministicFoodImageUrl(opts.title);
  }

  const foodish = await fetchFoodishImage(opts.title);
  if (foodish) return foodish;

  const deterministic = deterministicFoodImageUrl(opts.title);
  if (deterministic !== RECIPE_PLACEHOLDER_PATH) return deterministic;

  return RECIPE_PLACEHOLDER_PATH;
}
