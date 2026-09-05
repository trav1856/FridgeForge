import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scrapeRecipeFromUrl } from "@/lib/scrape-recipe";

const schema = z.object({
  url: z.string().url(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = schema.parse(body);
    const result = await scrapeRecipeFromUrl(url);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, fallback: true },
        { status: 422 }
      );
    }
    return NextResponse.json({ recipe: result.recipe });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
