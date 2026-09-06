import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseRecipeFromText } from "@/lib/scrape-recipe";
import { resolveRecipeImageUrl } from "@/lib/recipe-image";

const schema = z.object({
  text: z.string().min(20).max(100_000),
  sourceUrl: z.string().url().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sourceUrl } = schema.parse(body);
    const result = parseRecipeFromText(text, sourceUrl || undefined);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code ?? "PARSE_FAILED",
          suggestPaste: true,
          fallback: true,
        },
        { status: 422 }
      );
    }

    if (!result.recipe.imageUrl) {
      result.recipe.imageUrl = await resolveRecipeImageUrl({
        title: result.recipe.title,
      });
    }

    return NextResponse.json({ recipe: result.recipe });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
