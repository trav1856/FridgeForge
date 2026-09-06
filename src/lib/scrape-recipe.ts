import * as childProcess from "node:child_process";
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

export type ScrapeFailure = {
  ok: false;
  error: string;
  code?: "SITE_BLOCKED" | "PARSE_FAILED" | "INVALID_URL" | "FETCH_FAILED";
  suggestPaste?: boolean;
  status?: number;
};

export type ScrapeResult =
  | { ok: true; recipe: ScrapedRecipe }
  | ScrapeFailure;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
];

const SITE_BLOCKED_MSG =
  "This site blocked the automated import. Open the recipe in your browser, copy the ingredients & steps, then paste them below.";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickUa(attempt: number): string {
  return (
    process.env.SCRAPE_USER_AGENT ||
    USER_AGENTS[attempt % USER_AGENTS.length] ||
    USER_AGENTS[0]
  );
}

function browserHeaders(url: string, attempt: number): Record<string, string> {
  const ua = pickUa(attempt);
  let origin = "https://www.google.com";
  try {
    origin = new URL(url).origin;
  } catch {
    // ignore
  }
  const referers = [
    "https://www.google.com/",
    `${origin}/`,
    "https://www.bing.com/",
    "https://duckduckgo.com/",
  ];
  const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua);
  const headers: Record<string, string> = {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    Referer: referers[attempt % referers.length],
  };
  if (isChrome) {
    headers["Sec-Fetch-Dest"] = "document";
    headers["Sec-Fetch-Mode"] = "navigate";
    headers["Sec-Fetch-Site"] = attempt === 0 ? "none" : "cross-site";
    headers["Sec-Fetch-User"] = "?1";
    headers["Sec-Ch-Ua"] =
      '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"';
    headers["Sec-Ch-Ua-Mobile"] = "?0";
    headers["Sec-Ch-Ua-Platform"] = '"Windows"';
  }
  return headers;
}

/** Parse schema.org ISO 8601 durations (e.g. PT30M, PT1H15M) into whole minutes. */
export function isoDurationToMinutes(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  const s = String(raw).trim().toUpperCase();
  if (!s) return undefined;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return n > 0 ? Math.round(n) : undefined;
  }
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

function cookMinutesFromJsonLd(
  data: Record<string, unknown>
): number | undefined {
  const total = isoDurationToMinutes(data.totalTime);
  if (total != null) return total;
  const cook = isoDurationToMinutes(data.cookTime);
  const prep = isoDurationToMinutes(data.prepTime);
  if (cook != null && prep != null) return cook + prep;
  return cook ?? prep;
}

export function parseIngredientLine(line: string): {
  name: string;
  quantity: number;
  unit: string;
} {
  const cleaned = line
    .replace(/\s+/g, " ")
    .replace(/^[-•*▪◦]\s*/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
  // Parenthetical package sizes: "1 (8 ounce) package spaghetti"
  const pkg = cleaned.match(
    /^([\d./]+)\s*\([^)]+\)\s*(packages?|cans?|jars?|bags?)?\s*(.+)$/i
  );
  if (pkg) {
    let quantity = Number(pkg[1]);
    if (pkg[1].includes("/")) {
      const [a, b] = pkg[1].split("/").map(Number);
      quantity = b ? a / b : quantity || 1;
    }
    return {
      quantity: quantity || 1,
      unit: (pkg[2] || "each").toLowerCase(),
      name: pkg[3].trim(),
    };
  }
  // Mixed numbers: "1 1/2 cups flour"
  const mixed = cleaned.match(
    /^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|ml|l|cloves?|slices?|cans?|packages?|pinch|pinches|to taste)?\s+(?:of\s+)?(.+)$/i
  );
  if (mixed) {
    const whole = Number(mixed[1]);
    const a = Number(mixed[2]);
    const b = Number(mixed[3]);
    const quantity = whole + (b ? a / b : 0);
    return {
      quantity: quantity || 1,
      unit: (mixed[4] || "each").toLowerCase(),
      name: mixed[5].trim(),
    };
  }
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
    ".mm-recipes-structured-ingredients__list-item",
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
    ".mntl-sc-block-group--OL li",
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

const INGREDIENT_HEADERS =
  /^(ingredients?|what you(?:'|’)ll need|shopping list)\s*:?\s*$/i;
const STEP_HEADERS =
  /^(directions?|instructions?|method|steps?|preparation|how to make(?: it)?|procedure)\s*:?\s*$/i;
const OTHER_SECTION =
  /^(notes?|nutrition|tips?|yield|servings?|prep time|cook time|total time|equipment|tools?|variations?|storage|print|save|rate|reviews?|video|nutrition facts?)\s*:?\s*$/i;

function looksLikeIngredient(line: string): boolean {
  const s = line.replace(/^[-•*▪◦]\s*/, "").trim();
  if (!s || s.length > 200) return false;
  if (STEP_HEADERS.test(s) || OTHER_SECTION.test(s)) return false;
  // qty at start, or package form, or common unit words
  if (
    /^[\d½¼¾⅓⅔⅛⅜⅝⅞./]+\s/.test(s) ||
    /^\d+\s*\(/.test(s) ||
    /\b(cups?|tbsp|tsp|oz|lb|g|kg|ml|cloves?|slices?|cans?|packages?)\b/i.test(s)
  ) {
    return true;
  }
  // short noun-ish lines without sentence punctuation
  return s.length < 80 && !/[.!?]$/.test(s) && !/^\d+[.)]\s+\S/.test(s);
}

function looksLikeStep(line: string): boolean {
  const s = line.replace(/^\d+[.)]\s*/, "").trim();
  if (!s || s.length < 8) return false;
  if (INGREDIENT_HEADERS.test(s) || OTHER_SECTION.test(s)) return false;
  // Numbered steps or imperative/sentence-like
  if (/^\d+[.)]\s+\S/.test(line.trim())) return true;
  if (/[.!?]$/.test(s) || s.length > 40) return true;
  return /^(heat|add|mix|stir|cook|bake|bring|whisk|combine|place|pour|remove|serve|gather|meanwhile|while|drain|rinse|set|cut|slice|chop)/i.test(
    s
  );
}

/**
 * Parse pasted recipe text (ingredients + steps) into ScrapedRecipe shape.
 * Heuristics: section headers, numbered steps, qty-leading ingredient lines.
 */
export function parseRecipeFromText(
  text: string,
  sourceUrl?: string
): ScrapeResult {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw || raw.length < 20) {
    return {
      ok: false,
      error: "Paste the full ingredients and directions from the recipe page.",
      code: "PARSE_FAILED",
      suggestPaste: true,
    };
  }

  const lines = raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let title = "Imported recipe";
  let description: string | undefined;
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];

  // Title: first non-header line unless it starts with a quantity (ingredient)
  const first = lines[0];
  const firstLooksLikeQty =
    !!first &&
    (/^[\d½¼¾⅓⅔⅛⅜⅝⅞./]+\s/.test(first) ||
      /^\d+\s*\(/.test(first) ||
      INGREDIENT_HEADERS.test(first) ||
      STEP_HEADERS.test(first));
  if (first && !firstLooksLikeQty && first.length < 120) {
    title = first.replace(/\s*[|–—-]\s*Allrecipes.*$/i, "").trim() || title;
  }

  let mode: "none" | "ingredients" | "steps" = "none";
  let sawIngredientHeader = false;
  let sawStepHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line === title) continue;

    if (INGREDIENT_HEADERS.test(line)) {
      mode = "ingredients";
      sawIngredientHeader = true;
      continue;
    }
    if (STEP_HEADERS.test(line)) {
      mode = "steps";
      sawStepHeader = true;
      continue;
    }
    if (OTHER_SECTION.test(line)) {
      mode = "none";
      continue;
    }

    if (mode === "ingredients") {
      // Soft transition only for numbered/imperative steps, not qty-leading lines
      if (
        looksLikeStep(line) &&
        !looksLikeIngredient(line) &&
        ingredientLines.length >= 2
      ) {
        mode = "steps";
        stepLines.push(line.replace(/^\d+[.)]\s*/, "").trim());
        continue;
      }
      if (looksLikeIngredient(line) || line.length < 100) {
        ingredientLines.push(line);
      }
      continue;
    }

    if (mode === "steps") {
      const cleaned = line.replace(/^\d+[.)]\s*/, "").trim();
      if (cleaned) stepLines.push(cleaned);
      continue;
    }

    // No section yet — collect description or infer
    if (
      !sawIngredientHeader &&
      !sawStepHeader &&
      i <= 2 &&
      line.length > 40 &&
      /[.!?]$/.test(line) &&
      !looksLikeIngredient(line)
    ) {
      description = line.slice(0, 500);
      continue;
    }
  }

  // Fallback: no clear headers — split by heuristics
  if (ingredientLines.length < 2 || stepLines.length < 1) {
    const inferredIng: string[] = [];
    const inferredSteps: string[] = [];
    let phase: "pre" | "ing" | "step" = "pre";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && line === title) continue;
      if (INGREDIENT_HEADERS.test(line) || STEP_HEADERS.test(line)) continue;
      if (OTHER_SECTION.test(line)) {
        phase = "pre";
        continue;
      }

      const numbered = /^\d+[.)]\s+\S/.test(line);
      if (numbered || (phase === "step" && looksLikeStep(line))) {
        phase = "step";
        inferredSteps.push(line.replace(/^\d+[.)]\s*/, "").trim());
        continue;
      }
      if (looksLikeIngredient(line)) {
        phase = "ing";
        inferredIng.push(line);
        continue;
      }
      if (phase === "ing" && line.length < 100 && !/[.!?]$/.test(line)) {
        inferredIng.push(line);
        continue;
      }
      if (phase === "step" || (phase === "ing" && looksLikeStep(line))) {
        phase = "step";
        inferredSteps.push(line.replace(/^\d+[.)]\s*/, "").trim());
      }
    }
    if (ingredientLines.length < 2 && inferredIng.length >= 2) {
      ingredientLines.push(...inferredIng);
    }
    if (stepLines.length < 1 && inferredSteps.length >= 1) {
      stepLines.push(...inferredSteps);
    }
  }

  if (ingredientLines.length < 2 || stepLines.length < 1) {
    return {
      ok: false,
      error:
        "Could not find enough ingredients and steps. Include an Ingredients section and Directions/Instructions.",
      code: "PARSE_FAILED",
      suggestPaste: true,
    };
  }

  return {
    ok: true,
    recipe: {
      title,
      description,
      ingredients: ingredientLines.map(parseIngredientLine),
      steps: stepLines,
      sourceUrl: sourceUrl || "",
    },
  };
}

/**
 * Parse readable markdown/text from a reader proxy (e.g. r.jina.ai).
 */
export function parseRecipeFromMarkdown(
  markdown: string,
  sourceUrl?: string
): ScrapeResult {
  // Strip common jina/reader chrome
  let text = markdown
    .replace(/^Title:\s*/im, "")
    .replace(/^URL Source:\s*.+$/gim, "")
    .replace(/^Markdown Content:\s*/im, "")
    .replace(/^Published Time:.*$/gim, "")
    .replace(/^Warning:.*$/gim, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*/g, "")
    .trim();

  return parseRecipeFromText(text, sourceUrl);
}

function parseHtmlToRecipe(html: string, url: string): ScrapedRecipe | null {
  const $ = cheerio.load(html);
  const fromLd = fromJsonLd($);
  const recipe = fromLd ?? fromHtmlHeuristics($);
  if (!recipe || recipe.ingredients.length === 0 || recipe.steps.length === 0) {
    return null;
  }
  recipe.sourceUrl = url;
  return recipe;
}

export type CurlFetchResult =
  | { ok: true; html: string }
  | { ok: false; status?: number; error: string };

type CurlFetcher = (url: string, attempt: number) => Promise<CurlFetchResult>;

/** Test-only override for curl --http1.1 path (avoids ESM spawn spy limits). */
let curlFetcherOverride: CurlFetcher | null = null;

export function setCurlFetcherForTests(fn: CurlFetcher | null) {
  curlFetcherOverride = fn;
}

async function fetchViaCurl(
  url: string,
  attempt: number
): Promise<CurlFetchResult> {
  if (curlFetcherOverride) {
    return curlFetcherOverride(url, attempt);
  }
  const ua = pickUa(attempt);
  let referer = "https://www.google.com/";
  try {
    referer = attempt % 2 === 0 ? "https://www.google.com/" : `${new URL(url).origin}/`;
  } catch {
    // keep default
  }

  return new Promise((resolve) => {
    const args = [
      "--http1.1",
      "-L",
      "--max-time",
      "20",
      "--compressed",
      "-sS",
      "-A",
      ua,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "-e",
      referer,
      "-w",
      "\n__CURL_HTTP_STATUS__:%{http_code}",
      url,
    ];
    const child = childProcess.spawn("curl", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => errChunks.push(c));
    child.on("error", (err) => {
      resolve({
        ok: false,
        error: err.message || "curl spawn failed",
      });
    });
    child.on("close", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const statusMatch = raw.match(/\n__CURL_HTTP_STATUS__:(\d+)\s*$/);
      const status = statusMatch ? Number(statusMatch[1]) : undefined;
      const html = statusMatch
        ? raw.slice(0, statusMatch.index)
        : raw;
      if (status && status >= 200 && status < 300 && html.trim().length > 200) {
        resolve({ ok: true, html });
        return;
      }
      if (status === 403 || status === 429) {
        resolve({
          ok: false,
          status,
          error: SITE_BLOCKED_MSG,
        });
        return;
      }
      const stderr = Buffer.concat(errChunks).toString("utf8").trim();
      resolve({
        ok: false,
        status,
        error: stderr || `curl fetch failed (${status ?? "unknown"})`,
      });
    });
  });
}

async function fetchViaJina(
  url: string
): Promise<{ ok: true; text: string } | { ok: false; status?: number }> {
  try {
    const readerUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(readerUrl, {
      headers: {
        Accept: "text/plain",
        "User-Agent": pickUa(0),
      },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const text = await res.text();
    if (!text || text.trim().length < 80) {
      return { ok: false, status: res.status };
    }
    // 451 unavailable / legal exclusion pages
    if (/status code:\s*451|unavailable for legal reasons|excluded the domain/i.test(text)) {
      return { ok: false, status: 451 };
    }
    return { ok: true, text };
  } catch {
    return { ok: false };
  }
}

async function fetchViaGoogleCache(
  url: string
): Promise<{ ok: true; html: string } | { ok: false }> {
  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
    const res = await fetch(cacheUrl, {
      headers: browserHeaders(url, 0),
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return { ok: false };
    const html = await res.text();
    if (!html || html.length < 200) return { ok: false };
    return { ok: true, html };
  } catch {
    return { ok: false };
  }
}

type FetchHtmlResult =
  | { ok: true; html: string; via: "fetch" | "curl" | "cache" }
  | { ok: false; error: string; status?: number; blocked?: boolean };

/**
 * Fetch recipe HTML: Node fetch with retries → curl --http1.1 on soft block.
 * WAFs often fingerprint Node/undici TLS while curl HTTP/1.1 still works.
 */
export async function fetchRecipeHtml(url: string): Promise<FetchHtmlResult> {
  const maxAttempts = 3;
  let lastStatus: number | undefined;
  let lastError = "Fetch failed";
  let sawSoftBlock = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Longer backoff on soft blocks (403/429)
      const base = sawSoftBlock ? 800 : 350;
      await sleep(base * attempt + Math.floor(Math.random() * 400));
    }

    const headers = browserHeaders(url, attempt);
    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
      lastStatus = res.status;

      if (res.ok) {
        const html = await res.text();
        if (html && html.trim().length > 200) {
          return { ok: true, html, via: "fetch" };
        }
        lastError = "Empty response body";
        sawSoftBlock = true;
        continue;
      }

      if (res.status === 403 || res.status === 429) {
        sawSoftBlock = true;
        lastError =
          res.status === 403
            ? SITE_BLOCKED_MSG
            : "This site rate-limited the import (429). Wait a moment, try again, or paste the recipe below.";
        continue;
      }

      return {
        ok: false,
        status: res.status,
        error: `Fetch failed (${res.status})`,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Scrape failed";
      // network blip — retry
    }
  }

  // Soft block / empty: try curl --http1.1 (bypasses Node/undici TLS fingerprint)
  if (sawSoftBlock || lastStatus === 403 || lastStatus === 429 || !lastStatus) {
    for (let c = 0; c < 2; c++) {
      if (c > 0) await sleep(600 + Math.floor(Math.random() * 400));
      const curled = await fetchViaCurl(url, c + 1);
      if (curled.ok) {
        return { ok: true, html: curled.html, via: "curl" };
      }
      if (curled.status) lastStatus = curled.status;
      if (curled.error) lastError = curled.error;
      if (curled.status && curled.status !== 403 && curled.status !== 429) {
        break;
      }
    }
  }

  if (lastStatus === 403 || lastStatus === 429 || sawSoftBlock) {
    return {
      ok: false,
      status: lastStatus ?? 403,
      blocked: true,
      error: lastError || SITE_BLOCKED_MSG,
    };
  }

  return { ok: false, status: lastStatus, error: lastError };
}

export async function scrapeRecipeFromUrl(url: string): Promise<ScrapeResult> {
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return {
        ok: false,
        error: "URL must be http or https",
        code: "INVALID_URL",
      };
    }
  } catch {
    return { ok: false, error: "Invalid URL", code: "INVALID_URL" };
  }

  try {
    const fetched = await fetchRecipeHtml(url);

    if (fetched.ok) {
      const recipe = parseHtmlToRecipe(fetched.html, url);
      if (recipe) {
        const scrapedImage = extractRecipeImage(
          cheerio.load(fetched.html),
          url
        );
        recipe.imageUrl = await resolveRecipeImageUrl({
          title: recipe.title,
          scrapedImageUrl: scrapedImage,
        });
        return { ok: true, recipe };
      }
    }

    // Reader proxy (works for some sites; AllRecipes/People Inc often 451)
    const jina = await fetchViaJina(url);
    if (jina.ok) {
      const parsed = parseRecipeFromMarkdown(jina.text, url);
      if (parsed.ok) {
        parsed.recipe.imageUrl = await resolveRecipeImageUrl({
          title: parsed.recipe.title,
        });
        return parsed;
      }
    }

    // Google cache last resort (often blocked too)
    const cached = await fetchViaGoogleCache(url);
    if (cached.ok) {
      const recipe = parseHtmlToRecipe(cached.html, url);
      if (recipe) {
        const scrapedImage = extractRecipeImage(
          cheerio.load(cached.html),
          url
        );
        recipe.imageUrl = await resolveRecipeImageUrl({
          title: recipe.title,
          scrapedImageUrl: scrapedImage,
        });
        return { ok: true, recipe };
      }
    }

    if (fetched.ok === false && fetched.blocked) {
      return {
        ok: false,
        error: fetched.error || SITE_BLOCKED_MSG,
        code: "SITE_BLOCKED",
        suggestPaste: true,
        status: fetched.status,
      };
    }

    return {
      ok: false,
      error:
        "Could not parse recipe from page. Open it in your browser and paste ingredients & steps below.",
      code: "PARSE_FAILED",
      suggestPaste: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scrape failed";
    return {
      ok: false,
      error: msg,
      code: "FETCH_FAILED",
      suggestPaste: true,
    };
  }
}
