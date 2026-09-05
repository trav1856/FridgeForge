import { afterEach, describe, expect, it, vi } from "vitest";
import * as cheerio from "cheerio";
import { isoDurationToMinutes, scrapeRecipeFromUrl } from "@/lib/scrape-recipe";
import {
  RECIPE_PLACEHOLDER_PATH,
  deterministicFoodImageUrl,
  extractRecipeImage,
  hashTitle,
  resolveRecipeImageUrl,
} from "@/lib/recipe-image";

const RECIPE_HTML = `<!doctype html>
<html>
<head>
  <meta property="og:image" content="https://cdn.example.com/og-fallback.jpg" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": "Test Pasta",
    "description": "A weeknight bowl.",
    "totalTime": "PT25M",
    "image": "https://cdn.example.com/recipe-hero.jpg",
    "recipeIngredient": ["8 oz spaghetti", "2 tbsp olive oil"],
    "recipeInstructions": [
      { "@type": "HowToStep", "text": "Boil pasta." },
      { "@type": "HowToStep", "text": "Toss with oil." }
    ]
  }
  </script>
</head>
<body><h1>Test Pasta</h1></body>
</html>`;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function htmlResponse(html: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
    json: async () => ({}),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractRecipeImage", () => {
  it("prefers JSON-LD Recipe.image over og:image", () => {
    const $ = cheerio.load(RECIPE_HTML);
    expect(extractRecipeImage($, "https://example.com/pasta")).toBe(
      "https://cdn.example.com/recipe-hero.jpg"
    );
  });

  it("falls back to og:image, then twitter:image, then a large content img", () => {
    const $ = cheerio.load(`<html><head>
      <meta property="og:image" content="/photos/og.jpg" />
      <meta name="twitter:image" content="https://cdn.example.com/tw.jpg" />
    </head><body>
      <img src="/icon.png" width="16" height="16" />
      <img src="/big.jpg" width="800" height="600" />
    </body></html>`);
    expect(extractRecipeImage($, "https://example.com/r")).toBe(
      "https://example.com/photos/og.jpg"
    );

    const $tw = cheerio.load(`<html><head>
      <meta name="twitter:image" content="https://cdn.example.com/tw.jpg" />
    </head></html>`);
    expect(extractRecipeImage($tw, "https://example.com/r")).toBe(
      "https://cdn.example.com/tw.jpg"
    );

    const $img = cheerio.load(
      `<html><body><img src="https://cdn.example.com/hero.jpg" width="640" height="480" /></body></html>`
    );
    expect(extractRecipeImage($img, "https://example.com/r")).toBe(
      "https://cdn.example.com/hero.jpg"
    );
  });

  it("reads image objects and @graph Recipe nodes", () => {
    const $ = cheerio.load(`<script type="application/ld+json">
    {"@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Soup","image":{"url":"https://cdn.example.com/soup.jpg"},"recipeIngredient":["1 onion"],"recipeInstructions":["Simmer"]}]}
    </script>`);
    expect(extractRecipeImage($, "https://example.com/soup")).toBe(
      "https://cdn.example.com/soup.jpg"
    );
  });
});

describe("resolveRecipeImageUrl", () => {
  it("keeps a scraped URL and skips Foodish", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const url = await resolveRecipeImageUrl({
      title: "Pasta",
      scrapedImageUrl: "https://cdn.example.com/a.jpg",
    });
    expect(url).toBe("https://cdn.example.com/a.jpg");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Foodish when nothing was scraped", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ image: "https://foodish-api.com/images/pasta/pasta1.jpg" })
      )
    );
    const url = await resolveRecipeImageUrl({ title: "Lemon Garlic Pasta" });
    expect(url).toBe("https://foodish-api.com/images/pasta/pasta1.jpg");
  });

  it("falls back to branded placeholder if Foodish fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 503)));
    const url = await resolveRecipeImageUrl({ title: "Mystery Stew" });
    expect(url).toBe(RECIPE_PLACEHOLDER_PATH);
  });

  it("uses a stable Lorem Flickr URL for seeds", () => {
    const a = deterministicFoodImageUrl("Garlic Fried Rice with Crispy Egg");
    const b = deterministicFoodImageUrl("Garlic Fried Rice with Crispy Egg");
    expect(a).toBe(b);
    expect(a).toMatch(/^https:\/\/loremflickr\.com\/800\/600\/food,/);
    expect(a).toContain(`lock=${hashTitle("Garlic Fried Rice with Crispy Egg") % 100000}`);
  });
});


describe("isoDurationToMinutes", () => {
  it("parses common ISO 8601 recipe durations", () => {
    expect(isoDurationToMinutes("PT15M")).toBe(15);
    expect(isoDurationToMinutes("PT1H")).toBe(60);
    expect(isoDurationToMinutes("PT1H30M")).toBe(90);
    expect(isoDurationToMinutes("PT45S")).toBe(1);
    expect(isoDurationToMinutes("P1DT2H")).toBe(1560);
  });

  it("returns undefined for empty or invalid values", () => {
    expect(isoDurationToMinutes(undefined)).toBeUndefined();
    expect(isoDurationToMinutes("")).toBeUndefined();
    expect(isoDurationToMinutes("not-a-duration")).toBeUndefined();
  });
});

describe("scrapeRecipeFromUrl", () => {
  it("retries once after 403 and then parses the recipe + image", async () => {
    let pageHits = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("foodish-api.com")) {
          return jsonResponse({ image: "https://foodish-api.com/images/x.jpg" });
        }
        pageHits += 1;
        if (pageHits === 1) return htmlResponse("blocked", 403);
        return htmlResponse(RECIPE_HTML, 200);
      })
    );

    const result = await scrapeRecipeFromUrl("https://example.com/test-pasta");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toBe("Test Pasta");
    expect(result.recipe.ingredients.length).toBeGreaterThanOrEqual(2);
    expect(result.recipe.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.recipe.cookTimeMinutes).toBe(25);
    expect(result.recipe.imageUrl).toBe("https://cdn.example.com/recipe-hero.jpg");
    expect(pageHits).toBe(2);
  });

  it("surfaces a clear error if still blocked after retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        if (String(input).includes("foodish")) {
          return jsonResponse({ image: "https://foodish-api.com/images/x.jpg" });
        }
        return htmlResponse("nope", 403);
      })
    );

    const result = await scrapeRecipeFromUrl("https://example.com/walled");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/blocked the import \(403\)/i);
    expect(result.error).toMatch(/paste/i);
  });

  it("rejects non-http URLs", async () => {
    const result = await scrapeRecipeFromUrl("file:///etc/passwd");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/http/i);
  });
});
