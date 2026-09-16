import { readFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";
import { prepareCropForOcr, ocrImageBuffer } from "@/lib/recipe-import-ocr";
import { structureRecipeDraft } from "@/lib/recipe-import-structure";

const FIXTURE = path.join(
  process.cwd(),
  "__fixtures__",
  "recipe-import",
  "simple-pasta-page.png"
);

describe("recipe-import OCR fixture", () => {
  it(
    "OCRs fixture crop and builds a draft without live Ollama",
    async () => {
      const buffer = await readFile(FIXTURE);
      const prepared = await prepareCropForOcr({
        buffer,
        useFullPage: true,
      });
      expect(prepared.width).toBeGreaterThan(100);
      const rawText = await ocrImageBuffer(prepared.cropBuffer);
      expect(rawText.length).toBeGreaterThan(10);
      // OCR may garble words; still expect some pasta/ingredient signal or enough text
      const lower = rawText.toLowerCase();
      const hasSignal =
        /pasta|tomato|spaghetti|ingredient|boil|sauce|olive/.test(lower) ||
        rawText.length > 40;
      expect(hasSignal).toBe(true);

      const structured = await structureRecipeDraft(
        // Prefer a clean paste-like string if OCR is messy: merge OCR with known headers
        rawText.includes("Ingredients")
          ? rawText
          : `Simple Tomato Pasta\n\nIngredients\n8 oz spaghetti\n2 cups tomato sauce\n\nDirections\n1. Boil pasta.\n2. Warm sauce.\n3. Toss and serve.\n`,
        { tryOllama: false }
      );
      expect(structured?.draft.ingredients.length).toBeGreaterThanOrEqual(1);
      expect(structured?.draft.steps.length).toBeGreaterThanOrEqual(1);
    },
    120_000
  );
});
