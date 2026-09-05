import * as cheerio from "cheerio";

export type ScrapedRecipe = {
  title: string;
  description?: string;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
  sourceUrl: string;
};

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

      return {
        title: String(data.name || "Imported recipe"),
        description: data.description
          ? String(data.description).slice(0, 500)
          : undefined,
        ingredients: ingredientsRaw.map(parseIngredientLine),
        steps: instructions,
        sourceUrl: "",
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
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          process.env.SCRAPE_USER_AGENT ||
          "FridgeForge/0.1 (+local recipe import)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      return { ok: false, error: `Fetch failed (${res.status})` };
    }
    const html = await res.text();
    const $ = cheerio.load(html);
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
    return { ok: true, recipe };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scrape failed";
    return { ok: false, error: msg };
  }
}
