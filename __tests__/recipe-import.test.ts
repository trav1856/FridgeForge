import { describe, expect, it, vi } from "vitest";
import {
  boxFromDrag,
  boxToPixelRect,
  fullPageBox,
  normalizeBox,
} from "@/lib/recipe-import-crop";
import {
  parseDraftJson,
  pickOllamaModel,
  structureRecipeDraft,
  structureRecipeHeuristic,
} from "@/lib/recipe-import-structure";

describe("recipe-import-crop", () => {
  it("normalizes reverse drag and clamps", () => {
    const box = normalizeBox({ x: 0.6, y: 0.6, w: -0.3, h: -0.2 });
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0.3);
    expect(box!.y).toBeCloseTo(0.4);
    expect(box!.w).toBeCloseTo(0.3);
    expect(box!.h).toBeCloseTo(0.2);
  });

  it("rejects tiny boxes", () => {
    expect(normalizeBox({ x: 0.1, y: 0.1, w: 0.005, h: 0.5 })).toBeNull();
  });

  it("maps normalized box to pixels", () => {
    const rect = boxToPixelRect({ x: 0.1, y: 0.2, w: 0.5, h: 0.25 }, 200, 400);
    expect(rect).toEqual({ left: 20, top: 80, width: 100, height: 100 });
  });

  it("builds box from drag points", () => {
    const box = boxFromDrag(10, 20, 110, 120, 200, 200);
    expect(box).toEqual({ x: 0.05, y: 0.1, w: 0.5, h: 0.5 });
  });

  it("full page is unit square", () => {
    expect(fullPageBox()).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});

describe("parseDraftJson", () => {
  it("parses strict JSON draft", () => {
    const draft = parseDraftJson({
      title: "Soup",
      ingredients: [{ name: "broth", quantity: 2, unit: "cup" }],
      steps: ["Heat broth.", "Serve."],
      cookTimeMinutes: 15,
    });
    expect(draft?.title).toBe("Soup");
    expect(draft?.ingredients).toHaveLength(1);
    expect(draft?.steps).toHaveLength(2);
    expect(draft?.cookTimeMinutes).toBe(15);
  });

  it("parses string ingredients and fenced JSON", () => {
    const draft = parseDraftJson(`\`\`\`json
{"title":"Pasta","ingredients":["8 oz spaghetti","1 tbsp oil"],"steps":["Boil.","Toss."]}
\`\`\``);
    expect(draft?.title).toBe("Pasta");
    expect(draft?.ingredients[0].name.toLowerCase()).toContain("spaghetti");
    expect(draft?.steps[0]).toBe("Boil.");
  });

  it("returns null when missing steps", () => {
    expect(
      parseDraftJson({
        title: "X",
        ingredients: [{ name: "a", quantity: 1, unit: "each" }],
        steps: [],
      })
    ).toBeNull();
  });
});

describe("structure heuristic + ollama mock", () => {
  const SAMPLE = `Garlic Butter Toast

Ingredients
2 slices bread
1 tbsp butter
1 clove garlic

Directions
1. Toast the bread.
2. Melt butter with garlic and spread.
`;

  it("heuristic fallback structures paste-like OCR", () => {
    const result = structureRecipeHeuristic(SAMPLE);
    expect(result?.source).toBe("heuristic");
    expect(result?.draft.title.toLowerCase()).toContain("garlic");
    expect(result!.draft.ingredients.length).toBeGreaterThanOrEqual(2);
    expect(result!.draft.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("structureRecipeDraft uses heuristic when Ollama skipped", async () => {
    const result = await structureRecipeDraft(SAMPLE, { tryOllama: false });
    expect(result?.source).toBe("heuristic");
    expect(result?.draft.steps[0].toLowerCase()).toContain("toast");
  });

  it("structureRecipeDraft prefers mocked Ollama JSON", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/tags")) {
        return new Response(
          JSON.stringify({ models: [{ name: "nemotron-mini:latest" }] }),
          { status: 200 }
        );
      }
      if (u.endsWith("/api/generate")) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              title: "Ollama Pasta",
              ingredients: [{ name: "pasta", quantity: 8, unit: "oz" }],
              steps: ["Boil pasta.", "Drain."],
              notes: null,
            }),
          }),
          { status: 200 }
        );
      }
      return new Response("nope", { status: 404 });
    });

    const result = await structureRecipeDraft(SAMPLE, {
      host: "http://ollama.test:11434",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result?.source).toBe("ollama");
    expect(result?.model).toBe("nemotron-mini:latest");
    expect(result?.draft.title).toBe("Ollama Pasta");
  });

  it("pickOllamaModel prefers nemotron then gemma", () => {
    expect(
      pickOllamaModel(["llama3.2:1b", "gemma2:2b", "nemotron-mini:latest"])
    ).toBe("nemotron-mini:latest");
    expect(pickOllamaModel(["llama3.2:1b", "gemma2:2b"])).toBe("gemma2:2b");
  });
});
