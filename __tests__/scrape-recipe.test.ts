import { afterEach, describe, expect, it, vi } from "vitest";
import * as cheerio from "cheerio";
import {
  isoDurationToMinutes,
  parseRecipeFromMarkdown,
  parseRecipeFromText,
  scrapeRecipeFromUrl,
  setCurlFetcherForTests,
} from "@/lib/scrape-recipe";
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

const LO_MEIN_PASTE = `Lo Mein Noodles

These lo mein noodles feature spaghetti and crisp vegetables flavored with soy sauce, teriyaki, honey, and ginger for a quick and easy weeknight dish.

Ingredients
1 (8 ounce) package spaghetti
3 tablespoons low-sodium soy sauce
2 tablespoons teriyaki sauce
2 tablespoons honey
0.25 teaspoon ground ginger
2 tablespoons vegetable oil
3 stalks celery, sliced
2 large carrots, cut into large matchsticks
0.5 sweet onion, thinly sliced
2 green onions, sliced

Directions
1. Gather all ingredients.
2. Bring a large pot of lightly salted water to a boil. Cook spaghetti in boiling water, stirring occasionally, until tender yet firm to the bite, about 12 minutes; drain, then rinse with cold water to cool.
3. Meanwhile, whisk soy sauce, teriyaki sauce, honey, and ginger together in a small bowl; set aside.
4. While the spaghetti cooks, heat oil in a large skillet or wok over high heat. Cook and stir celery, carrots, onion, and green onions until slightly tender, 5 to 7 minutes.
5. Add spaghetti and soy sauce mixture. Cook, stirring frequently, until heated through and evenly coated, about 2 to 3 minutes. Serve garnished with additional sliced green onions, if desired.
`;

const JINA_MARKDOWN = `Title: Easy Garlic Pasta

URL Source: https://example.com/garlic-pasta

Markdown Content:
# Easy Garlic Pasta

## Ingredients
- 8 oz spaghetti
- 2 tbsp olive oil
- 3 cloves garlic, minced

## Instructions
1. Boil the pasta until al dente.
2. Warm oil and garlic in a pan.
3. Toss pasta with garlic oil and serve.
`;

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
  setCurlFetcherForTests(null);
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
  it("keeps a scraped URL and skips TheMealDB", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const url = await resolveRecipeImageUrl({
      title: "Pasta",
      scrapedImageUrl: "https://cdn.example.com/a.jpg",
    });
    expect(url).toBe("https://cdn.example.com/a.jpg");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses TheMealDB when nothing was scraped", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          meals: [
            {
              strMeal: "Pasta",
              strMealThumb: "https://www.themealdb.com/images/media/meals/pasta.jpg",
            },
          ],
        })
      )
    );
    const url = await resolveRecipeImageUrl({ title: "Lemon Garlic Pasta" });
    expect(url).toBe("https://www.themealdb.com/images/media/meals/pasta.jpg");
  });

  it("falls back to branded placeholder if TheMealDB fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 503)));
    const url = await resolveRecipeImageUrl({ title: "Mystery Stew" });
    expect(url).toBe(RECIPE_PLACEHOLDER_PATH);
  });

  it("sync seed helper stays placeholder (no Lorem Flickr); async resolves MealDB", () => {
    const a = deterministicFoodImageUrl("Garlic Fried Rice with Crispy Egg");
    const b = deterministicFoodImageUrl("Lemon-Garlic Butter Pasta");
    expect(a).toBe(RECIPE_PLACEHOLDER_PATH);
    expect(b).toBe(RECIPE_PLACEHOLDER_PATH);
    expect(a.includes("loremflickr")).toBe(false);
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

describe("parseRecipeFromText", () => {
  it("parses Lo Mein paste fixture into ingredients and steps", () => {
    const result = parseRecipeFromText(
      LO_MEIN_PASTE,
      "https://www.allrecipes.com/recipe/233446/lo-mein-noodles/"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toMatch(/lo mein/i);
    expect(result.recipe.sourceUrl).toContain("allrecipes.com");
    expect(result.recipe.ingredients.length).toBeGreaterThanOrEqual(8);
    expect(
      result.recipe.ingredients.some((i) => /spaghetti/i.test(i.name))
    ).toBe(true);
    expect(
      result.recipe.ingredients.some((i) => /soy sauce/i.test(i.name))
    ).toBe(true);
    expect(result.recipe.steps.length).toBeGreaterThanOrEqual(4);
    expect(result.recipe.steps[0]).toMatch(/gather/i);
    expect(
      result.recipe.steps.some((s) => /whisk soy sauce/i.test(s))
    ).toBe(true);
  });

  it("fails clearly when paste is too thin", () => {
    const result = parseRecipeFromText("just a title");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.suggestPaste).toBe(true);
  });
});

describe("parseRecipeFromMarkdown", () => {
  it("parses jina-style markdown without hitting the network", () => {
    const result = parseRecipeFromMarkdown(
      JINA_MARKDOWN,
      "https://example.com/garlic-pasta"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toMatch(/garlic pasta/i);
    expect(result.recipe.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(result.recipe.steps.length).toBeGreaterThanOrEqual(3);
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
        if (url.includes("r.jina.ai") || url.includes("webcache.google")) {
          return htmlResponse("nope", 503);
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
    expect(pageHits).toBeGreaterThanOrEqual(2);
  });

  it("falls back to curl HTML when Node fetch stays 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("foodish-api.com")) {
          return jsonResponse({ image: "https://foodish-api.com/images/x.jpg" });
        }
        if (url.includes("r.jina.ai") || url.includes("webcache.google")) {
          return htmlResponse("blocked", 451);
        }
        return htmlResponse("nope", 403);
      })
    );
    setCurlFetcherForTests(async () => ({ ok: true, html: RECIPE_HTML }));

    const result = await scrapeRecipeFromUrl("https://example.com/walled");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recipe.title).toBe("Test Pasta");
    expect(result.recipe.ingredients.length).toBeGreaterThanOrEqual(2);
  }, 15000);

  it("surfaces SITE_BLOCKED + suggestPaste if fetch and curl both fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("foodish")) {
          return jsonResponse({ image: "https://foodish-api.com/images/x.jpg" });
        }
        if (url.includes("r.jina.ai") || url.includes("webcache.google")) {
          return htmlResponse("nope", 451);
        }
        return htmlResponse("nope", 403);
      })
    );
    setCurlFetcherForTests(async () => ({
      ok: false,
      status: 403,
      error: "This site blocked the automated import. Open the recipe in your browser, copy the ingredients & steps, then paste them below.",
    }));

    const result = await scrapeRecipeFromUrl("https://example.com/walled");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("SITE_BLOCKED");
    expect(result.suggestPaste).toBe(true);
    expect(result.error).toMatch(/paste/i);
  }, 15000);

  it("rejects non-http URLs", async () => {
    const result = await scrapeRecipeFromUrl("file:///etc/passwd");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/http/i);
  });
});
