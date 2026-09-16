import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "@/lib/html-entities";

describe("decodeHtmlEntities", () => {
  it("decodes apostrophe entity in titles", () => {
    expect(decodeHtmlEntities("Bubbie&#39;s Hamantaschen")).toBe(
      "Bubbie's Hamantaschen"
    );
  });
  it("decodes amp and quot", () => {
    expect(decodeHtmlEntities("A &amp; B &quot;C&quot;")).toBe('A & B "C"');
  });
});
