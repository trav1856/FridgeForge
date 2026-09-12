import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

function source(rel: string): string {
  return readFileSync(resolve(__dirname, "..", rel), "utf8");
}

/** Count <Link> opens vs </Link> closes in a snippet. */
function linkBalance(snippet: string): { opens: number; closes: number } {
  return {
    opens: (snippet.match(/<Link\b/g) || []).length,
    closes: (snippet.match(/<\/Link>/g) || []).length,
  };
}

describe("Cook Now card markup", () => {
  it("does not nest DealsBanner inside the recipe card Link", () => {
    const src = source("src/components/SuggestionsView.tsx");
    const sectionStart = src.indexOf("function Section(");
    expect(sectionStart).toBeGreaterThan(-1);
    const section = src.slice(sectionStart);
    const dealsIdx = section.indexOf("<DealsBanner");
    expect(dealsIdx).toBeGreaterThan(-1);
    const before = section.slice(0, dealsIdx);
    const { opens, closes } = linkBalance(before);
    expect(opens).toBe(closes);
  });

  it("does not wrap block UI (div / DealsBanner / RecipeIcons) in a <p>", () => {
    const src = source("src/components/SuggestionsView.tsx");
    const section = src.slice(src.indexOf("function Section("));
    // Naive scan: a <p ...> that later contains <div, <DealsBanner, or <RecipeIcons before </p>
    const pRe = /<p\b[^>]*>/g;
    let m: RegExpExecArray | null;
    const offenders: string[] = [];
    while ((m = pRe.exec(section))) {
      const from = m.index + m[0].length;
      const close = section.indexOf("</p>", from);
      if (close < 0) continue;
      const inner = section.slice(from, close);
      if (/<(div|DealsBanner|RecipeIcons)\b/.test(inner)) {
        offenders.push(inner.slice(0, 80).replace(/\s+/g, " "));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("DealsBanner compact coupon links", () => {
  it("uses Link (not nested-safe by itself) and stopPropagation", () => {
    const src = source("src/components/DealsBanner.tsx");
    expect(src).toMatch(/href=\{\`\/coupons\/\$\{d\.id\}\`\}/);
    expect(src).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
  });
});
