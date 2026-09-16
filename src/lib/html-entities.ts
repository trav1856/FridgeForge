/**
 * Decode common HTML entities in recipe text (OCR / LLM / scraped HTML).
 * Pure — safe for unit tests and API sanitize.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decode &#39; &#x27; &amp; &quot; &lt; &gt; and similar in a string. */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (input == null) return "";
  let s = String(input);
  if (!s.includes("&")) return s;

  // Numeric decimal: &#39;
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
    try {
      return String.fromCodePoint(code);
    } catch {
      return _;
    }
  });

  // Numeric hex: &#x27; &#X27;
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    const code = parseInt(h, 16);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
    try {
      return String.fromCodePoint(code);
    } catch {
      return _;
    }
  });

  // Named entities we care about (repeat for double-encoding like &amp;#39;)
  for (let i = 0; i < 3; i++) {
    const next = s.replace(/&([a-zA-Z]+);/g, (full, name: string) => {
      const hit = NAMED[name.toLowerCase()];
      return hit !== undefined ? hit : full;
    });
    if (next === s) break;
    s = next;
    // After &amp; → &, re-run numeric in case of &amp;#39;
    if (s.includes("&#")) {
      s = s.replace(/&#(\d+);/g, (_, n) => {
        const code = Number(n);
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
        try {
          return String.fromCodePoint(code);
        } catch {
          return _;
        }
      });
      s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
        const code = parseInt(h, 16);
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _;
        try {
          return String.fromCodePoint(code);
        } catch {
          return _;
        }
      });
    }
  }

  return s;
}

export function decodeHtmlEntitiesNullable(
  input: string | null | undefined
): string | null {
  if (input == null) return null;
  const d = decodeHtmlEntities(input);
  return d.length ? d : null;
}

/** Decode title/description/steps/ingredient names on an import-like draft. */
export function decodeRecipeTextFields<
  T extends {
    title?: string | null;
    description?: string | null;
    notes?: string | null;
    steps?: string[] | null;
    ingredients?: { name: string; [k: string]: unknown }[] | null;
  },
>(draft: T): T {
  const steps = Array.isArray(draft.steps)
    ? draft.steps.map((s) => decodeHtmlEntities(s))
    : draft.steps;
  const ingredients = Array.isArray(draft.ingredients)
    ? draft.ingredients.map((ing) => ({
        ...ing,
        name: decodeHtmlEntities(ing.name),
      }))
    : draft.ingredients;
  return {
    ...draft,
    ...(draft.title !== undefined
      ? { title: decodeHtmlEntities(draft.title ?? "") }
      : {}),
    ...(draft.description !== undefined
      ? { description: decodeHtmlEntitiesNullable(draft.description) }
      : {}),
    ...(draft.notes !== undefined
      ? { notes: decodeHtmlEntitiesNullable(draft.notes) }
      : {}),
    ...(steps !== undefined ? { steps } : {}),
    ...(ingredients !== undefined ? { ingredients } : {}),
  };
}
