import { describe, expect, it, vi } from "vitest";
import { parseReceiptText } from "../src/lib/receipt-parse";
import {
  extractUpcFromLine,
  resolveReceiptItemSync,
  resolveReceiptItems,
} from "../src/lib/receipt-resolve";
import type { BarcodeLookupResult } from "../src/lib/open-food-facts";

describe("parseReceiptText", () => {
  it("extracts priced grocery lines and skips totals", () => {
    const text = `
WHOLE FOODS MARKET
Thank you for shopping
Organic Milk 2%          4.99
2x Large Eggs            6.50
Bananas 1.2 lb           0.79
Subtotal                12.28
Tax                      0.80
TOTAL                   13.08
`;
    const items = parseReceiptText(text);
    const names = items.map((i) => i.name.toLowerCase());
    expect(names.some((n) => n.includes("milk"))).toBe(true);
    expect(names.some((n) => n.includes("egg"))).toBe(true);
    expect(names.some((n) => n.includes("banana"))).toBe(true);
    expect(names.some((n) => n.includes("total"))).toBe(false);
    const eggs = items.find((i) => /egg/i.test(i.name));
    expect(eggs?.quantity).toBe(2);
  });

  it("handles pasted plain lists without prices", () => {
    const items = parseReceiptText("Rice\nBlack beans\nSoy sauce");
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.map((i) => i.name.toLowerCase())).toEqual(
      expect.arrayContaining(["rice", "black beans", "soy sauce"])
    );
  });
});

describe("extractUpcFromLine", () => {
  it("pulls 12-digit UPC and ignores prices", () => {
    expect(
      extractUpcFromLine("GV BEEF 0078742051234 5.99")
    ).toBe("0078742051234");
    expect(extractUpcFromLine("BANANAS 4011 0.54")).toBeNull();
    expect(extractUpcFromLine("Milk 2% 3.49")).toBeNull();
  });

  it("accepts EAN-13 style codes", () => {
    expect(extractUpcFromLine("ORG SPIN 5012345678901 2.50")).toBe(
      "5012345678901"
    );
  });
});

describe("resolveReceiptItemSync dictionary", () => {
  it("expands GV BEEF into Great Value beef with hint", () => {
    const parsed = parseReceiptText("GV BEEF                 5.99");
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    const resolved = resolveReceiptItemSync(parsed[0]);
    expect(resolved.rawName.toUpperCase()).toContain("GV");
    expect(resolved.resolvedName.toLowerCase()).toContain("great value");
    expect(resolved.resolvedName.toLowerCase()).toContain("beef");
    expect(resolved.brand).toBe("Great Value");
    expect(resolved.source).toBe("dictionary");
    expect(resolved.category).toBe("Proteins");
  });

  it("resolves 10 COUNT GRP into grapes with pack qty", () => {
    const parsed = parseReceiptText("10 COUNT GRP            2.48");
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    const resolved = resolveReceiptItemSync(parsed[0]);
    expect(resolved.resolvedName.toLowerCase()).toContain("grape");
    expect(resolved.quantity).toBe(10);
    expect(resolved.source).toBe("dictionary");
    expect(resolved.category).toBe("Produce");
  });

  it("expands Marketside organic spinach shorthand", () => {
    const parsed = parseReceiptText("MS ORGNC SPIN           3.29");
    const resolved = resolveReceiptItemSync(parsed[0]);
    expect(resolved.brand).toBe("Marketside");
    expect(resolved.resolvedName.toLowerCase()).toMatch(/spinach/);
    expect(resolved.resolvedName.toLowerCase()).toMatch(/organic/);
  });

  it("expands HV house brand and CHK chicken", () => {
    const parsed = parseReceiptText("HV CHK BRST             7.99");
    const resolved = resolveReceiptItemSync(parsed[0]);
    expect(resolved.brand).toBe("Great Value");
    expect(resolved.resolvedName.toLowerCase()).toContain("chicken");
    expect(resolved.notes || "").toMatch(/HV/i);
  });

  it("keeps rawLine and detects UPC without looking it up sync", () => {
    const line = "GV MLK 2% 0078742087654 2.19";
    const parsed = parseReceiptText(line);
    const resolved = resolveReceiptItemSync(parsed[0]);
    expect(resolved.rawLine).toContain("0078742087654");
    expect(resolved.barcode).toBe("0078742087654");
    expect(resolved.rawName.toLowerCase()).toMatch(/mlk|milk|gv/i);
  });
});

describe("resolveReceiptItems UPC preference", () => {
  it("prefers Open Food Facts name when UPC lookup hits", async () => {
    const text = "GV BEEF 0078742051234 5.99\n10 COUNT GRP 2.48";
    const parsed = parseReceiptText(text);
    const lookupBarcode = vi.fn(
      async (code: string): Promise<BarcodeLookupResult> => {
        if (code === "0078742051234") {
          return {
            found: true,
            barcode: code,
            name: "Angus Beef Steak",
            brand: "Great Value",
            suggestedCategory: "Proteins",
            suggestedUnit: "each",
          };
        }
        return { found: false, barcode: code };
      }
    );

    const resolved = await resolveReceiptItems(parsed, {
      lookupBarcode,
      tryOllama: false,
    });

    const beef = resolved.find((r) => r.barcode === "0078742051234");
    expect(beef).toBeTruthy();
    expect(beef!.source).toBe("upc");
    expect(beef!.resolvedName.toLowerCase()).toContain("angus beef");
    expect(beef!.brand).toMatch(/great value/i);
    expect(beef!.confidence).toBe("high");

    const grapes = resolved.find((r) =>
      r.resolvedName.toLowerCase().includes("grape")
    );
    expect(grapes).toBeTruthy();
    expect(grapes!.source).toBe("dictionary");
    expect(lookupBarcode).toHaveBeenCalled();
  });

  it("falls back to dictionary when UPC lookup misses", async () => {
    const parsed = parseReceiptText("GV BEEF 0078742059999 5.99");
    const resolved = await resolveReceiptItems(parsed, {
      lookupBarcode: async (code) => ({ found: false, barcode: code }),
      tryOllama: false,
    });
    expect(resolved[0].source).toBe("dictionary");
    expect(resolved[0].resolvedName.toLowerCase()).toContain("beef");
    expect(resolved[0].barcode).toBe("0078742059999");
  });
});
