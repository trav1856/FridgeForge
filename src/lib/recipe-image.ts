import type * as cheerio from "cheerio";

/** Local branded fallback — UI never looks empty. */
export const RECIPE_PLACEHOLDER_PATH = "/recipe-images/placeholder.svg";

/**
 * Image strategy (import + seeds):
 * 1. Scraped from page: JSON-LD Recipe.image → og:image → twitter:image → large <img>
 * 2. Free food photo via Foodish (no API key): https://foodish-api.com/api/
 * 3. Branded SVG at /recipe-images/placeholder.svg
 *
 * We store remote URLs on Recipe.imageUrl (no local download required).
 * Seed recipes use deterministic Lorem Flickr food URLs (?lock=) keyed by title.
 */

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

function foodishCategoryForTitle(title: string): string | null {
  const t = title.toLowerCase();
  const map: [RegExp, string][] = [
    [/pizza/, "pizza"],
    [/burger|sandwich/, "burger"],
    [/pasta|spaghetti|noodle|macaroni/, "pasta"],
    [/rice|biryani|fried rice/, "rice"],
    [/dessert|cake|cookie|brownie|pudding/, "dessert"],
    [/dosa/, "dosa"],
    [/idli|idly/, "idly"],
    [/sambar|sambhar/, "sambhar"],
    [/butter chicken|curry|chicken/, "butter-chicken"],
  ];
  for (const [re, cat] of map) {
    if (re.test(t)) return cat;
  }
  return null;
}

/** Stable 32-bit hash for deterministic placeholder locks. */
export function hashTitle(title: string): number {
  let h = 2166136261;
  for (let i = 0; i < title.length; i++) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic free food image URL for seeds (no API key).
 * Lorem Flickr: food + keyword, ?lock= for stability.
 */
export function deterministicFoodImageUrl(title: string): string {
  const lock = hashTitle(title) % 100000;
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["with", "and", "the", "for"].includes(w));
  const keyword = words[0] || "meal";
  const tags = ["food", keyword].join(",");
  return `https://loremflickr.com/800/600/${encodeURIComponent(tags).replace(/%2C/g, ",")}?lock=${lock}`;
}

/**
 * Fetch a random (or category-ish) food image from Foodish — free, no key.
 * https://foodish-api.com/
 */
export async function fetchFoodishImage(
  title?: string
): Promise<string | null> {
  const category = title ? foodishCategoryForTitle(title) : null;
  const endpoints = category
    ? [
        `https://foodish-api.com/api/images/${category}/`,
        "https://foodish-api.com/api/",
      ]
    : ["https://foodish-api.com/api/"];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { image?: string };
      if (data.image && typeof data.image === "string") return data.image;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Resolve final image URL: scraped → Foodish → branded placeholder.
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

  return RECIPE_PLACEHOLDER_PATH;
}
