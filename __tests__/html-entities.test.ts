import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  decodeRecipeTextFields,
} from "@/lib/html-entities";
import { parseDraftJson } from "@/lib/recipe-import-structure";
import { sanitizeRecipeWritePayload } from "@/lib/sanitize-recipe-text";

describe("decodeHtmlEntities", () => {
  it("decodes apostrophe, amp, quot, lt, gt and numeric forms", () => {
    expect(decodeHtmlEntities("Bubbie&#39;s Hamantaschen")).toBe(
      "Bubbie's Hamantaschen"
    );
    expect(decodeHtmlEntities("A &amp; B")).toBe("A & B");
    expect(decodeHtmlEntities("&quot;hi&quot;")).toBe('"hi"');
    expect(decodeHtmlEntities("&lt;b&gt;")).toBe("<b>");
    expect(decodeHtmlEntities("&#x27;")).toBe("'");
    expect(decodeHtmlEntities("Tom &amp;&#39; Jerry")).toBe("Tom &' Jerry");
  });

  it("handles double-encoded amp+numeric", () => {
    expect(decodeHtmlEntities("Bubbie&amp;#39;s")).toBe("Bubbie's");
  });
});

describe("decodeRecipeTextFields + import draft", () => {
  it("decodes title/steps/ingredients on draft", () => {
    const d = decodeRecipeTextFields({
      title: "Bubbie&#39;s Cookies",
      description: "Mom &amp; me",
      steps: ["Mix &amp; chill"],
      ingredients: [{ name: "sugar &amp; spice", quantity: 1, unit: "cup" }],
    });
    expect(d.title).toBe("Bubbie's Cookies");
    expect(d.description).toBe("Mom & me");
    expect(d.steps?.[0]).toBe("Mix & chill");
    expect(d.ingredients?.[0].name).toBe("sugar & spice");
  });

  it("parseDraftJson decodes entities from LLM JSON", () => {
    const draft = parseDraftJson({
      title: "Bubbie&#39;s Hamantaschen",
      ingredients: [{ name: "flour &amp; salt", quantity: 2, unit: "cups" }],
      steps: ["Fill with jam &amp; bake"],
    });
    expect(draft).toBeTruthy();
    expect(draft!.title).toBe("Bubbie's Hamantaschen");
    expect(draft!.ingredients[0].name).toBe("flour & salt");
    expect(draft!.steps[0]).toBe("Fill with jam & bake");
  });
});

describe("sanitizeRecipeWritePayload", () => {
  it("decodes on create/update payloads", () => {
    const cleaned = sanitizeRecipeWritePayload({
      title: "Bubbie&#39;s",
      description: "A &amp; B",
      steps: ["Fold &amp; seal"],
      ingredients: [{ name: "poppy &amp; prune", quantity: 1, unit: "cup" }],
    });
    expect(cleaned.title).toBe("Bubbie's");
    expect(cleaned.description).toBe("A & B");
    expect(cleaned.steps[0]).toBe("Fold & seal");
    expect(cleaned.ingredients[0].name).toBe("poppy & prune");
  });
});
