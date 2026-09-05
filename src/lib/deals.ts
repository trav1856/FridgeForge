import { namesMatch, normalizeName, expandAliases } from "./normalize";
import type { CouponDTO } from "./coupons";

export type CouponMatchInput = {
  id: string;
  brand: string;
  title: string;
  discountText: string;
  codeValue: string;
  used: boolean;
  expiresAt: Date | string | null;
};

export type DealCouponSummary = {
  id: string;
  brand: string;
  title: string;
  discountText: string;
  matchedIngredients: string[];
};

const STOP_WORDS = new Set([
  "any",
  "the",
  "and",
  "or",
  "for",
  "off",
  "with",
  "from",
  "free",
  "jar",
  "can",
  "oz",
  "lb",
  "pack",
  "size",
  "demo",
  "valid",
  "limit",
  "one",
  "per",
  "purchase",
  "coupon",
  "offer",
  "bogo",
  "get",
  "buy",
  "second",
  "equal",
  "lesser",
  "value",
  "large",
  "grade",
  "dozen",
  "chunk",
  "light",
  "plus",
  "bag",
]);

/** Bigrams that should stay intact (don't match bare first word to noodles, etc.). */
const PROTECTED_COMPOUNDS = [
  "pasta sauce",
  "tomato sauce",
  "soy sauce",
  "peanut butter",
  "hot sauce",
];

function isActiveCoupon(c: {
  used: boolean;
  expiresAt: Date | string | null;
}): boolean {
  if (c.used) return false;
  if (!c.expiresAt) return true;
  const t =
    c.expiresAt instanceof Date
      ? c.expiresAt.getTime()
      : new Date(c.expiresAt).getTime();
  return Number.isFinite(t) && t >= Date.now();
}

function phraseInField(fieldNorm: string, form: string): boolean {
  if (!form || form.length < 2) return false;
  const padded = ` ${fieldNorm} `;
  const needle = ` ${form} `;
  let from = 0;
  while (from < padded.length) {
    const idx = padded.indexOf(needle, from);
    if (idx === -1) return false;
    const before = padded.slice(0, idx + 1);
    const after = padded.slice(idx + needle.length - 1);
    // "pasta" inside "pasta sauce" should not count as pasta noodles
    if (form === "pasta" && after.startsWith(" sauce")) {
      from = idx + needle.length;
      continue;
    }
    if (form === "butter" && / peanut $/.test(before)) {
      from = idx + needle.length;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Match a missing ingredient against coupon brand, title, discountText,
 * and code-related product keywords (fuzzy via namesMatch / aliases).
 */
export function couponMatchesIngredient(
  coupon: Pick<
    CouponMatchInput,
    "brand" | "title" | "discountText" | "codeValue"
  >,
  ingredientName: string
): boolean {
  const fields = [
    coupon.brand,
    coupon.title,
    coupon.discountText,
    coupon.codeValue.replace(/[-_]/g, " "),
  ];

  const forms = expandAliases(ingredientName).filter((f) => f.length >= 2);

  for (const field of fields) {
    const nf = normalizeName(field);
    if (!nf) continue;

    if (namesMatch(field, ingredientName)) return true;

    // Protected compounds: match the whole compound to tomato/sauce-style ingredients
    for (const compound of PROTECTED_COMPOUNDS) {
      if (phraseInField(nf, compound) && namesMatch(compound, ingredientName)) {
        return true;
      }
    }

    for (const form of forms) {
      if (phraseInField(nf, form)) return true;
    }

    // Loose token pass (skip stop words + first words of protected compounds)
    const tokens = nf.split(/\s+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    for (let i = 0; i < tokens.length; i++) {
      const bigram = i < tokens.length - 1 ? `${tokens[i]} ${tokens[i + 1]}` : "";
      if (PROTECTED_COMPOUNDS.includes(bigram)) {
        if (namesMatch(bigram, ingredientName)) return true;
        i++; // skip next unigram
        continue;
      }
      if (namesMatch(tokens[i], ingredientName)) return true;
    }
  }
  return false;
}

/**
 * For missing ingredients, return active coupons that match (deduped).
 * Empty when nothing is missing or no coupons apply.
 */
export function findDealsForMissingIngredients(
  missingIngredients: string[],
  coupons: CouponMatchInput[]
): DealCouponSummary[] {
  if (missingIngredients.length === 0) return [];

  const active = coupons.filter(isActiveCoupon);
  const byId = new Map<string, DealCouponSummary>();

  for (const ingredient of missingIngredients) {
    for (const coupon of active) {
      if (!couponMatchesIngredient(coupon, ingredient)) continue;
      const existing = byId.get(coupon.id);
      if (existing) {
        if (!existing.matchedIngredients.includes(ingredient)) {
          existing.matchedIngredients.push(ingredient);
        }
      } else {
        byId.set(coupon.id, {
          id: coupon.id,
          brand: coupon.brand,
          title: coupon.title,
          discountText: coupon.discountText,
          matchedIngredients: [ingredient],
        });
      }
    }
  }

  return [...byId.values()];
}

export function toDealSummariesFromDTOs(
  missingIngredients: string[],
  coupons: CouponDTO[]
): DealCouponSummary[] {
  return findDealsForMissingIngredients(
    missingIngredients,
    coupons.map((c) => ({
      id: c.id,
      brand: c.brand,
      title: c.title,
      discountText: c.discountText,
      codeValue: c.codeValue,
      used: c.used,
      expiresAt: c.expiresAt,
    }))
  );
}

export { isActiveCoupon };
