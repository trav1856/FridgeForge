export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  unit: string;
  confidence: "high" | "medium" | "low";
  rawLine: string;
};

const SKIP_LINE =
  /\b(total|subtotal|sub total|tax|change|cash|card|visa|mastercard|debit|credit|balance|thank|welcome|store|receipt|tel|phone|www\.|http|cashier|register|invoice|date|time|qty\s*desc|item\s*price|amount due|save|savings|coupon|loyalty|member|approved|auth|ref\s*#|tran\s*#)\b/i;

const PRICE_AT_END =
  /^(.*?)(?:\s{2,}|\s+)\$?\s*(\d{1,4}[.,]\d{2})\s*[A-Z]?\s*$/;

const QTY_PREFIX = /^(?:(\d+(?:[.,]\d+)?)\s*[xX×]\s*|(\d+)\s*@\s*)(.+)$/;
const QTY_IN_PARENS = /\((\d+(?:[.,]\d+)?)\s*(ea|each|ct|pk|pack|lb|oz|kg|g|ml|l)?\)/i;
const WEIGHT_QTY = /(\d+(?:[.,]\d+)?)\s*(lb|oz|kg|g|ml|l)\b/i;

function cleanName(raw: string): string {
  let s = raw
    .replace(/\$?\s*\d+[.,]\d{2}\s*[A-Z]?\s*$/g, "")
    .replace(/\b\d{6,}\b/g, "") // long SKUs / UPCs (UPC kept via rawLine in resolver)
    .replace(/\s{2,}/g, " ")
    .trim();
  // Keep leading pack counts like "10 COUNT" / "12CT" / "6 PK"
  if (!/^\d+(?:[.,]\d+)?\s*(?:COUNT|CNT|CT|PK|PACK|PKG|EA|EACH)\b/i.test(s)) {
    s = s.replace(/^[\d\W]+/, "");
  }
  return s
    .replace(/[^\w\s&/'%-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeGroceryName(name: string): boolean {
  if (name.length < 2 || name.length > 80) return false;
  if (!/[a-zA-Z]/.test(name)) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

/** Best-effort grocery line-item extraction from OCR or pasted receipt text. */
export function parseReceiptText(text: string): ParsedReceiptItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedReceiptItem[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (line.length < 3) continue;
    if (SKIP_LINE.test(line)) continue;
    if (/^[\W\d\s]+$/.test(line)) continue;
    if (/^\d{1,2}[/.-]\d{1,2}/.test(line)) continue; // dates

    let name = "";
    let quantity = 1;
    let unit = "each";
    let confidence: ParsedReceiptItem["confidence"] = "low";

    const priceMatch = line.match(PRICE_AT_END);
    const working = priceMatch ? priceMatch[1].trim() : line;

    if (priceMatch) confidence = "medium";

    const qtyPrefix = working.match(QTY_PREFIX);
    if (qtyPrefix) {
      quantity = parseFloat((qtyPrefix[1] || qtyPrefix[2] || "1").replace(",", ".")) || 1;
      name = cleanName(qtyPrefix[3]);
      confidence = "high";
    } else {
      const paren = working.match(QTY_IN_PARENS);
      const weight = working.match(WEIGHT_QTY);
      if (paren) {
        quantity = parseFloat(paren[1].replace(",", ".")) || 1;
        unit = paren[2] ? normalizeUnit(paren[2]) : "each";
        name = cleanName(working.replace(paren[0], ""));
        confidence = "high";
      } else if (weight) {
        quantity = parseFloat(weight[1].replace(",", ".")) || 1;
        unit = normalizeUnit(weight[2]);
        name = cleanName(working.replace(weight[0], ""));
        confidence = priceMatch ? "high" : "medium";
      } else {
        name = cleanName(working);
        if (priceMatch && looksLikeGroceryName(name)) confidence = "medium";
      }
    }

    if (!looksLikeGroceryName(name)) continue;

    // Drop very short leftover after cleaning if it looks like a code
    if (/^[A-Z0-9]{1,4}$/.test(name)) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) {
      const existing = items.find((i) => i.name.toLowerCase() === key);
      if (existing) existing.quantity += quantity;
      continue;
    }
    seen.add(key);

    items.push({
      name,
      quantity,
      unit,
      confidence,
      rawLine: line,
    });
  }

  return items;
}

function normalizeUnit(u: string): string {
  const x = u.toLowerCase();
  if (x === "ea" || x === "ct") return "each";
  if (x === "pk") return "pack";
  return x;
}
