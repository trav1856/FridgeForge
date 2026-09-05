import { describe, expect, it } from "vitest";
import { parseReceiptText } from "../src/lib/receipt-parse";

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
