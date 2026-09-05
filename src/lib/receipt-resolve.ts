import type { ParsedReceiptItem } from "./receipt-parse";
import {
  lookupOpenFoodFacts,
  type BarcodeLookupResult,
} from "./open-food-facts";
import type { PantryCategory } from "./categories";

export type ResolveSource = "upc" | "dictionary" | "ollama" | "raw";

export type ResolvedReceiptItem = {
  /** Cleaned name before brand/abbrev expansion (no UPC/price). */
  rawName: string;
  /** Human / pantry-ready suggested name (editable default in UI). */
  resolvedName: string;
  brand?: string;
  quantity: number;
  unit: string;
  category?: PantryCategory | string;
  confidence: "high" | "medium" | "low";
  notes?: string;
  rawLine: string;
  /** Detected UPC/EAN when present on the receipt line. */
  barcode?: string | null;
  source: ResolveSource;
};

/** Walmart-focused store brand codes (extensible). */
export const BRAND_CODES: Record<string, string> = {
  GV: "Great Value",
  HV: "Great Value",
  MV: "Marketside",
  MS: "Marketside",
  EQ: "Equate",
  MM: "Member's Mark",
  WM: "Walmart",
  SB: "Sam's Choice",
  SC: "Sam's Choice",
};

/**
 * Common US grocery receipt product abbreviations.
 * Keys are uppercase tokens as they appear on receipts.
 */
export const PRODUCT_ABBREVS: Record<string, string> = {
  GRP: "grapes",
  GRPS: "grapes",
  BROC: "broccoli",
  BROCCOLI: "broccoli",
  POT: "potato",
  POTS: "potatoes",
  POTATO: "potato",
  TOM: "tomato",
  TOMS: "tomatoes",
  TOMATO: "tomato",
  CHK: "chicken",
  CHKN: "chicken",
  CHICK: "chicken",
  BRST: "breast",
  THGH: "thigh",
  BEEF: "beef",
  BF: "beef",
  PORK: "pork",
  PRK: "pork",
  TRKY: "turkey",
  TURK: "turkey",
  MLK: "milk",
  MILK: "milk",
  EGG: "eggs",
  EGGS: "eggs",
  BNS: "beans",
  BN: "beans",
  BEAN: "beans",
  RCE: "rice",
  RICE: "rice",
  PST: "pasta",
  PASTA: "pasta",
  BRD: "bread",
  BREAD: "bread",
  BTR: "butter",
  BUTTER: "butter",
  CHS: "cheese",
  CHEESE: "cheese",
  YGRT: "yogurt",
  YOG: "yogurt",
  ONION: "onion",
  ON: "onion",
  GAR: "garlic",
  GRLC: "garlic",
  CARROT: "carrot",
  CRT: "carrot",
  CEL: "celery",
  BAN: "banana",
  BANS: "bananas",
  APL: "apple",
  APLS: "apples",
  ORG: "organic",
  ORNG: "orange",
  ORGS: "oranges",
  LET: "lettuce",
  LETT: "lettuce",
  SPIN: "spinach",
  CUC: "cucumber",
  CUKES: "cucumbers",
  PEP: "pepper",
  PEPP: "pepper",
  AVOC: "avocado",
  AVO: "avocado",
  STRAW: "strawberries",
  BLUB: "blueberries",
  WHP: "whipping cream",
  CRM: "cream",
  OJ: "orange juice",
  JCE: "juice",
  WTR: "water",
  SODA: "soda",
  CHP: "chips",
  CRL: "cereal",
  FLR: "flour",
  SGR: "sugar",
  OIL: "oil",
  VINEGAR: "vinegar",
  SOY: "soy sauce",
  KETCH: "ketchup",
  MUST: "mustard",
  MAYO: "mayonnaise",
  BACON: "bacon",
  HAM: "ham",
  SALM: "salmon",
  TUNA: "tuna",
  SHR: "shrimp",
  FZN: "frozen",
  ORGNC: "organic",
  WHL: "whole",
  SKIM: "skim",
  LRGE: "large",
  SM: "small",
  MED: "medium",
};

/** Soft culinary hints appended for ambiguous proteins / staples. */
const FOOD_HINTS: Record<string, string> = {
  beef: "quick steak / steak",
  steak: "quick sear",
  chicken: "breast / thighs",
  pork: "chops / roast",
  turkey: "ground / slices",
};

const CATEGORY_RULES: [RegExp, PantryCategory][] = [
  [/\b(rice|pasta|noodle|bread|flour|cereal|oat|tortilla|grain)\b/i, "Grains"],
  [
    /\b(chicken|beef|pork|turkey|egg|tuna|salmon|shrimp|bacon|ham|bean|tofu|meat)\b/i,
    "Proteins",
  ],
  [
    /\b(grapes?|bananas?|apples?|oranges?|lettuce|spinach|tomatoes?|potatoes?|onions?|garlic|carrots?|celery|broccoli|peppers?|avocados?|berr(?:y|ies)|produce|cucumbers?)\b/i,
    "Produce",
  ],
  [/\b(milk|cheese|yogurt|butter|cream|dairy)\b/i, "Dairy"],
  [/\b(canned|tin)\b/i, "Canned"],
  [/\b(spice|salt|pepper|chili|seasoning)\b/i, "Spices"],
  [
    /\b(oil|vinegar|sauce|ketchup|mustard|mayo|soy|condiment)\b/i,
    "Oils & Condiments",
  ],
];

const PACK_COUNT_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:COUNT|CNT|CT|PK|PACK|PKG|EA|EACH)\b/gi;
const STANDALONE_PACK_RE =
  /^(\d+)\s*(?:COUNT|CNT|CT|PK|PACK|PKG)\b|\b(\d+)\s*(?:COUNT|CNT|CT|PK|PACK|PKG)$/i;

/**
 * Extract a likely UPC/EAN (8–14 digits) from a receipt line.
 * Skips price-like decimals and short produce PLUs (typically 4–5 digits).
 */
export function extractUpcFromLine(line: string): string | null {
  // Prefer digit runs that are not part of a decimal price (e.g. 3.49).
  const candidates: string[] = [];
  const re = /(?<![.\d])(\d{8,14})(?![.\d])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    candidates.push(m[1]);
  }
  if (candidates.length === 0) return null;

  // Prefer standard UPC-A (12) / EAN-13 (13), then 8/14.
  const ranked = [...candidates].sort((a, b) => {
    const score = (c: string) =>
      c.length === 12 ? 3 : c.length === 13 ? 2 : c.length === 8 || c.length === 14 ? 1 : 0;
    return score(b) - score(a);
  });
  return ranked[0] ?? null;
}

function titleCaseWord(w: string): string {
  if (!w) return w;
  if (w.length <= 2 && w === w.toUpperCase()) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function prettyFoodName(parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p) =>
      p
        .split(/\s+/)
        .map((w) => titleCaseWord(w))
        .join(" ")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function suggestCategory(name: string): PantryCategory | undefined {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(name)) return cat;
  }
  return undefined;
}

function normalizeUnitToken(u: string): string {
  const x = u.toLowerCase();
  if (x === "ea" || x === "each" || x === "ct" || x === "cnt" || x === "count") {
    return "each";
  }
  if (x === "pk" || x === "pack" || x === "pkg") return "pack";
  return x;
}

/** Pull pack-count from name tokens; returns qty override + cleaned tokens. */
export function extractPackCount(tokens: string[]): {
  quantity?: number;
  unit?: string;
  rest: string[];
} {
  const joined = tokens.join(" ");
  PACK_COUNT_RE.lastIndex = 0;
  const m = PACK_COUNT_RE.exec(joined);
  if (!m) return { rest: tokens };

  const quantity = parseFloat(m[1]) || undefined;
  const unitToken = m[0].replace(/^\d+(?:\.\d+)?\s*/i, "");
  const unit = normalizeUnitToken(unitToken);
  const restJoined = joined.replace(m[0], " ").replace(/\s+/g, " ").trim();
  const rest = restJoined ? restJoined.split(/\s+/) : [];
  return { quantity, unit: quantity != null ? unit : undefined, rest };
}

export function expandBrandAndProduct(rawName: string): {
  brand?: string;
  productParts: string[];
  expandedAny: boolean;
  notes: string[];
} {
  const tokens = rawName
    .toUpperCase()
    .replace(/[^A-Z0-9%\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const notes: string[] = [];
  let brand: string | undefined;
  const productParts: string[] = [];
  let expandedAny = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Skip pure pack markers already handled elsewhere (COUNT alone, etc.)
    if (/^(COUNT|CNT|CT|PK|PACK|PKG|EA|EACH)$/.test(t)) continue;
    if (/^\d+(\.\d+)?$/.test(t)) {
      // Keep numeric size tokens like 2% for milk — handled as product text
      const next = tokens[i + 1];
      if (next && /^(COUNT|CNT|CT|PK|PACK|PKG|EA|EACH)$/.test(next)) {
        continue; // pack qty consumed by extractPackCount
      }
      productParts.push(t);
      continue;
    }

    if (!brand && BRAND_CODES[t]) {
      brand = BRAND_CODES[t];
      expandedAny = true;
      if (t === "HV") notes.push("HV → Great Value (house brand)");
      continue;
    }

    if (PRODUCT_ABBREVS[t]) {
      productParts.push(PRODUCT_ABBREVS[t]);
      expandedAny = true;
      continue;
    }

    // Unknown token: keep as lowercase word (likely truncated product)
    productParts.push(t.toLowerCase());
  }

  return { brand, productParts, expandedAny, notes };
}

function buildResolvedName(
  brand: string | undefined,
  productParts: string[],
  packQty?: number
): string {
  const food = productParts.join(" ").trim();
  const hintKey = food.toLowerCase().split(/\s+/)[0] ?? "";
  const hint = FOOD_HINTS[hintKey];

  let core = prettyFoodName([brand ?? "", food].filter(Boolean));
  if (!core) core = "Unknown item";

  if (hint && productParts.length === 1) {
    core = `${core} (${hint})`;
  }

  if (packQty != null && packQty > 1 && !/\bcount\b/i.test(core)) {
    // Prefer "Grapes (10 count)" style when pack was the main signal
    if (productParts.length === 1) {
      core = `${prettyFoodName(productParts)} (${packQty} count)`;
      if (brand) core = `${prettyFoodName([brand])} ${core}`;
    }
  }

  return core.replace(/\s+/g, " ").trim();
}

/** Sync dictionary / raw resolve (no network). */
export function resolveReceiptItemSync(
  item: ParsedReceiptItem
): ResolvedReceiptItem {
  const barcode = extractUpcFromLine(item.rawLine);
  const rawName = item.name.trim();
  // Prefer pack signals from cleaned name; fall back to rawLine (cleanName used to strip leading qty).
  const nameTokens = rawName.split(/\s+/).filter(Boolean);
  let pack = extractPackCount(nameTokens);
  if (pack.quantity == null) {
    const lineSansPrice = item.rawLine
      .replace(/\$?\s*\d+[.,]\d{2}\s*[A-Z]?\s*$/g, "")
      .replace(/\b\d{8,14}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    pack = extractPackCount(lineSansPrice.split(/\s+/).filter(Boolean));
  }
  const nameForExpand =
    (pack.rest.length ? pack.rest.join(" ") : "") ||
    rawName.replace(STANDALONE_PACK_RE, "").trim() ||
    rawName;

  const { brand, productParts, expandedAny, notes } =
    expandBrandAndProduct(nameForExpand);

  const quantity =
    pack.quantity != null && item.quantity === 1
      ? pack.quantity
      : item.quantity;
  const unit =
    pack.unit && (item.unit === "each" || !item.unit)
      ? pack.unit
      : item.unit || "each";

  let resolvedName: string;
  let confidence = item.confidence;
  let source: ResolveSource = "raw";

  if (expandedAny || pack.quantity != null) {
    resolvedName = buildResolvedName(brand, productParts, pack.quantity);
    source = "dictionary";
    // Cryptic all-caps abbrevs that we expanded → medium/high
    if (expandedAny && brand) confidence = "high";
    else if (expandedAny) confidence = confidence === "low" ? "medium" : confidence;
    else confidence = confidence === "low" ? "medium" : confidence;
  } else {
    resolvedName = prettyFoodName(productParts.length ? productParts : [rawName]);
    // Still looks cryptic (short ALL CAPS / heavy abbrev)
    if (/^[A-Z0-9\s]{2,12}$/.test(rawName) && rawName === rawName.toUpperCase()) {
      confidence = "low";
      notes.push("Could not expand receipt shorthand");
    }
  }

  // If we found a UPC but are still in sync path, note it for async enrichment
  if (barcode) {
    notes.push(`UPC detected: ${barcode}`);
  }

  const category = suggestCategory(resolvedName);
  const noteStr = notes.length ? notes.join("; ") : undefined;

  return {
    rawName,
    resolvedName,
    brand,
    quantity,
    unit,
    category,
    confidence,
    notes: noteStr,
    rawLine: item.rawLine,
    barcode: barcode ?? null,
    source,
  };
}

async function ollamaSuggestFoodName(
  rawName: string,
  rawLine: string,
  host: string
): Promise<string | null> {
  try {
    const base = host.replace(/\/$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3.2:1b",
        stream: false,
        format: "json",
        prompt: `You expand US grocery receipt shorthand into a pantry food name.
Return JSON only: {"name":"...","brand":null,"confidence":"low|medium|high"}
Receipt line: ${rawLine}
Cleaned tokens: ${rawName}
No commentary.`,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    const text = data.response || "";
    const parsed = JSON.parse(text) as { name?: string };
    if (parsed?.name && typeof parsed.name === "string" && parsed.name.length > 1) {
      return parsed.name.trim().slice(0, 120);
    }
  } catch {
    // fail open
  }
  return null;
}

async function isOllamaReachable(host: string): Promise<boolean> {
  try {
    const base = host.replace(/\/$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export type ResolveOptions = {
  /** Inject for tests; defaults to Open Food Facts. */
  lookupBarcode?: (code: string) => Promise<BarcodeLookupResult>;
  /** Attempt local Ollama for low-confidence lines. Default true when env/host up. */
  tryOllama?: boolean;
  ollamaHost?: string;
};

/**
 * Resolve parsed lines: UPC → Open Food Facts first, then dictionary,
 * then optional Ollama for remaining low-confidence rows.
 */
export async function resolveReceiptItems(
  items: ParsedReceiptItem[],
  options: ResolveOptions = {}
): Promise<ResolvedReceiptItem[]> {
  const lookup = options.lookupBarcode ?? lookupOpenFoodFacts;
  const ollamaHost =
    options.ollamaHost ||
    process.env.OLLAMA_HOST ||
    "http://127.0.0.1:11434";
  const wantOllama = options.tryOllama !== false;

  let ollamaOk: boolean | null = null;

  const out: ResolvedReceiptItem[] = [];

  for (const item of items) {
    let resolved = resolveReceiptItemSync(item);

    if (resolved.barcode) {
      try {
        const off = await lookup(resolved.barcode);
        if (off.found && off.name) {
          const brand =
            off.brand?.split(",")[0]?.trim() || resolved.brand || undefined;
          let name = off.name;
          if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
            name = `${brand} ${name}`;
          }
          resolved = {
            ...resolved,
            resolvedName: name.trim(),
            brand: brand || resolved.brand,
            category: off.suggestedCategory || resolved.category,
            unit:
              resolved.unit === "each" && off.suggestedUnit
                ? off.suggestedUnit
                : resolved.unit,
            confidence: "high",
            source: "upc",
            notes: [
              resolved.notes,
              `Resolved via UPC ${resolved.barcode} (Open Food Facts)`,
            ]
              .filter(Boolean)
              .join("; "),
            barcode: resolved.barcode,
          };
          out.push(resolved);
          continue;
        }
      } catch {
        // fall through to dictionary result already in `resolved`
      }
    }

    if (
      wantOllama &&
      resolved.confidence === "low" &&
      resolved.source !== "upc"
    ) {
      if (ollamaOk === null) {
        ollamaOk = await isOllamaReachable(ollamaHost);
      }
      if (ollamaOk) {
        const suggestion = await ollamaSuggestFoodName(
          resolved.rawName,
          resolved.rawLine,
          ollamaHost
        );
        if (suggestion) {
          resolved = {
            ...resolved,
            resolvedName: suggestion,
            confidence: "medium",
            source: "ollama",
            notes: [resolved.notes, "Suggested by local Ollama"]
              .filter(Boolean)
              .join("; "),
            category: suggestCategory(suggestion) || resolved.category,
          };
        }
      }
    }

    out.push(resolved);
  }

  return out;
}

/** Convenience: parse-ready pipeline helper used by API tests. */
export function mapResolvedToApiShape(item: ResolvedReceiptItem) {
  return {
    name: item.resolvedName,
    rawName: item.rawName,
    resolvedName: item.resolvedName,
    brand: item.brand ?? null,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category ?? null,
    confidence: item.confidence,
    notes: item.notes ?? null,
    rawLine: item.rawLine,
    barcode: item.barcode ?? null,
    source: item.source,
  };
}
