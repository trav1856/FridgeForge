import * as cheerio from "cheerio";
import {
  extractRecipeImage,
  resolveRecipeImageUrl,
} from "@/lib/recipe-image";

export type ScrapedRecipe = {
  title: string;
  description?: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
  sourceUrl: string;
  imageUrl?: string;
  cookTimeMinutes?: number;
};

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function browserHeaders(_url: string): Record<string, string> {
  return {
    "User-Agent": process.env.SCRAPE_USER_AGENT || DEFAULT_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-Ch-Ua":
      '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    Referer: "https://www.google.com/",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/** Parse schema.org ISO 8601 durations (e.g. PT30M, PT1H15M) into whole minutes. */
export function isoDurationToMinutes(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  const s = String(raw).trim().toUpperCase();
  if (!s) return undefined;
  // Plain minutes number as string
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n > 0 ? Math.round(n) : undefined;
  }
  // PnDTnHnMnS — days/hours/minutes/seconds
  const m = s.match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );
  if (!m) return undefined;
  const days = Number(m[1] || 0);
  const hours = Number(m[2] || 0);
  const minutes = Number(m[3] || 0);
  const seconds = Number(m[4] || 0);
  const total = days * 24 * 60 + hours * 60 + minutes + seconds / 60;
  if (!Number.isFinite(total) || total <= 0) return undefined;
  return Math.max(1, Math.round(total));
}

function cookMinutesFromJsonLd(data: Record<string, unknown>): number | undefined {
  // Prefer totalTime; fall back to cookTime (+ prepTime if both present without total)
  const total = isoDurationToMinutes(data.totalTime);
  if (total != null) return total;
  const cook = isoDurationToMinutes(data.cookTime);
  const prep = isoDurationToMinutes(data.prepTime);
  if (cook != null && prep != null) return cook + prep;
  return cook ?? prep;
}


function parseIngredientLine(line: string): {
  name: string;
  quantity: number;
  unit: string;
} {
  const cleaned = line.replace(/\s+/g, " ").trim();
  const m = cleaned.match(
    /^([\d./]+)\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|ml|l|cloves?|slices?|cans?|packages?|pinch|pinches|to taste)?\s+(?:of\s+)?(.+)$/i
  );
  if (m) {
    const qtyRaw = m[1];
    let quantity = 1;
    if (qtyRaw.includes("/")) {
      const [a, b] = qtyRaw.split("/").map(Number);
      quantity = b ? a / b : Number(qtyRaw) || 1;
    } else {
      quantity = Number(qtyRaw) || 1;
    }
    return {
      quantity,
      unit: (m[2] || "each").toLowerCase(),
      name: m[3].trim(),
    };
  }
  return { name: cleaned, quantity: 1, unit: "each" };
}

function fromJsonLd($: cheerio.CheerioAPI): ScrapedRecipe | null {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html();
    if (!raw) continue;
    try {
      let data = JSON.parse(raw);
      if (Array.isArray(data)) data = data.find((d) => isRecipe(d)) ?? data[0];
      if (data?.["@graph"]) {
        data = data["@graph"].find((d: unknown) => isRecipe(d)) ?? data;
      }
      if (!isRecipe(data)) continue;

      const ingredientsRaw: string[] = Array.isArray(data.recipeIngredient)
        ? data.recipeIngredient
        : [];
      const instructions = normalizeInstructions(data.recipeInstructions);

      const cookTimeMinutes = cookMinutesFromJsonLd(
        data as Record<string, unknown>
      );

      return {
        title: String(data.name || "Imported recipe"),
        description: data.description
          ? String(data.description).slice(0, 500)
          : undefined,
        ingredients: ingredientsRaw.map(parseIngredientLine),
        steps: instructions,
        sourceUrl: "",
        ...(cookTimeMinutes != null ? { cookTimeMinutes } : {}),
      };
    } catch {
      // try next script
    }
  }
  return null;
}

function isRecipe(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const t = (data as { "@type"?: string | string[] })["@type"];
  if (!t) return false;
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => String(x).toLowerCase().includes("recipe"));
}

function normalizeInstructions(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const obj = item as { text?: string; itemListElement?: unknown };
          if (obj.text) return String(obj.text).trim();
          if (Array.isArray(obj.itemListElement)) {
            return normalizeInstructions(obj.itemListElement).join(" ");
          }
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

function fromHtmlHeuristics($: cheerio.CheerioAPI): ScrapedRecipe | null {
  const title =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim();
  if (!title) return null;

  const ingredientSelectors = [
    ".recipe-ingredients li",
    ".ingredients li",
    "[itemprop='recipeIngredient']",
    ".wprm-recipe-ingredient",
    ".tasty-recipes-ingredients li",
    "ul.ingredients li",
  ];
  let ingredients: string[] = [];
  for (const sel of ingredientSelectors) {
    const found = $(sel)
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    if (found.length >= 2) {
      ingredients = found;
      break;
    }
  }

  const stepSelectors = [
    ".recipe-instructions li",
    ".instructions li",
    "[itemprop='recipeInstructions'] li",
    ".wprm-recipe-instruction",
    ".tasty-recipes-instructions li",
    "ol.instructions li",
  ];
  let steps: string[] = [];
  for (const sel of stepSelectors) {
    const found = $(sel)
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);
    if (found.length >= 1) {
      steps = found;
      break;
    }
  }

  if (ingredients.length < 2 || steps.length < 1) return null;

  return {
    title,
    ingredients: ingredients.map(parseIngredientLine),
    steps,
    sourceUrl: "",
  };
}

async function fetchRecipeHtml(
  url: string
): Promise<
  | { ok: true; html: string }
  | { ok: false; error: string; status?: number }
> {
  const headers = browserHeaders(url);
  let lastStatus: number | undefined;
  let lastError = "Fetch failed";

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 1) {
      // Short backoff before retrying soft blocks (403/429)
      await sleep(400 + Math.floor(Math.random() * 350));
      // On retry, look more like a same-site navigation
      try {
        headers.Referer = new URL(url).origin + "/";
        headers["Sec-Fetch-Site"] = "same-origin";
      } catch {
        // ignore
      }
    }

    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      });
      lastStatus = res.status;

      if (res.ok) {
        return { ok: true, html: await res.text() };
      }

      if ((res.status === 403 || res.status === 429) && attempt === 0) {
        lastError = `Fetch failed (${res.status})`;
        continue;
      }

      if (res.status === 403 || res.status === 429) {
        return {
          ok: false,
          status: res.status,
          error:
            res.status === 403
              ? "This site blocked the import (403). Many recipe sites reject automated fetches — open the page in your browser and paste ingredients/steps manually."
              : "This site rate-limited the import (429). Wait a moment and try once more, or paste the recipe manually.",
        };
      }

      return {
        ok: false,
        status: res.status,
        error: `Fetch failed (${res.status})`,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Scrape failed";
      if (attempt === 0) continue;
    }
  }

  if (lastStatus === 403 || lastStatus === 429) {
    return {
      ok: false,
      status: lastStatus,
      error:
        lastStatus === 403
          ? "This site blocked the import (403). Many recipe sites reject automated fetches — open the page in your browser and paste ingredients/steps manually."
          : "This site rate-limited the import (429). Wait a moment and try once more, or paste the recipe manually.",
    };
  }

  return { ok: false, status: lastStatus, error: lastError };
}

export async function scrapeRecipeFromUrl(
  url: string
): Promise<{ ok: true; recipe: ScrapedRecipe } | { ok: false; error: string }> {
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { ok: false, error: "URL must be http or https" };
    }
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  try {
    const fetched = await fetchRecipeHtml(url);
    if (!fetched.ok) {
      return { ok: false, error: fetched.error };
    }

    const $ = cheerio.load(fetched.html);
    const fromLd = fromJsonLd($);
    const recipe = fromLd ?? fromHtmlHeuristics($);
    if (!recipe || recipe.ingredients.length === 0 || recipe.steps.length === 0) {
      return {
        ok: false,
        error:
          "Could not parse recipe from page. Paste ingredients and steps manually.",
      };
    }

    recipe.sourceUrl = url;
    const scrapedImage = extractRecipeImage($, url);
    recipe.imageUrl = await resolveRecipeImageUrl({
      title: recipe.title,
      scrapedImageUrl: scrapedImage,
    });

    return { ok: true, recipe };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scrape failed";
    return { ok: false, error: msg };
  }
}
