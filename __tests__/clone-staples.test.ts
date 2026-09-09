import { describe, expect, it, vi } from "vitest";
import {
  cloneStapleRecipesToHousehold,
  isStapleOrClassicTagJson,
} from "@/lib/clone-staples";

describe("isStapleOrClassicTagJson", () => {
  it("detects staple and classic tags", () => {
    expect(isStapleOrClassicTagJson(JSON.stringify(["staple"]))).toBe(true);
    expect(isStapleOrClassicTagJson(JSON.stringify(["Classic"]))).toBe(true);
    expect(isStapleOrClassicTagJson(JSON.stringify(["dinner"]))).toBe(false);
    expect(isStapleOrClassicTagJson(null)).toBe(false);
  });
});

describe("cloneStapleRecipesToHousehold", () => {
  it("is a no-op and does not create rows", async () => {
    const create = vi.fn();
    const findMany = vi.fn();
    const prisma = {
      recipe: { findMany, create },
    } as never;

    const n = await cloneStapleRecipesToHousehold(prisma, "hh-any");
    expect(n).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
