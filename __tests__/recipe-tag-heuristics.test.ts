import { describe, expect, it } from "vitest";
import { inferRecipeTaxonomy } from "@/lib/recipe-taxonomy";
import { inferAllergenTags } from "@/lib/allergens";
import { inferDietaryEligibility, recipeHasMeatAndDairy } from "@/lib/dietary";
import { stripNonDairyPhrases } from "@/lib/ingredient-phrases";

const ings = (...names: string[]) => names.map((name) => ({ name }));

// Regression cases from the Sept 2026 tag audit (bare-substring false positives).
describe("inferRecipeTaxonomy: whole-word matching, field-appropriate text", () => {
  it("Mongolian beef noodles: Chinese main beef, no dessert/nut/legume", () => {
    const t = inferRecipeTaxonomy({
      title: "One-Pan Mongolian Beef Noodles with broccoli",
      description: "Instant ramen noodle cakes simmered in a sweet-savory sauce.",
      tags: ["struggle"],
      ingredients: ings(
        "broccoli florets",
        "water",
        "Ramen Noodles",
        "Dark Soy Sauce",
        "hoisin sauce",
        "Mirin",
        "Chinese Five Spice Powder",
        "sesame oil",
        "oil",
        "garlic cloves",
        "onion",
        "ground beef"
      ),
      steps: ["Cook for 5 minutes.", "Repeat with the remaining pieces."],
    });
    expect(t.cuisine).toBe("Chinese");
    expect(t.origins).toEqual(expect.arrayContaining(["chinese", "asian"]));
    expect(t.course).toBe("main");
    expect(t.meatType).toBe("beef");
    expect(t.foodCategories).toEqual(
      expect.arrayContaining(["meat", "grain", "vegetable", "condiment"])
    );
    for (const bad of ["dessert", "nut", "legume"]) {
      expect(t.foodCategories).not.toContain(bad);
    }
  });

  it("Lo mein made with spaghetti + teriyaki is Chinese, not Italian/Japanese", () => {
    const t = inferRecipeTaxonomy({
      title: "Lo Mein Noodles",
      tags: ["struggle"],
      ingredients: ings("spaghetti", "low-sodium soy sauce", "teriyaki sauce", "honey"),
    });
    expect(t.cuisine).toBe("Chinese");
    expect(t.origins).toEqual(["chinese", "asian"]);
  });

  it("peanut-soy spaghetti is not Italian and peanut butter is not dairy", () => {
    const t = inferRecipeTaxonomy({
      title: "Peanut-Cabbage Noodle Stir",
      tags: ["pasta", "dinner"],
      ingredients: ings("Spaghetti", "Green cabbage", "Peanut butter", "Soy sauce"),
    });
    expect(t.cuisine).not.toBe("Italian");
    expect(t.origins).toContain("asian");
    expect(t.foodCategories).not.toContain("dairy");
    expect(t.foodCategories).toContain("nut");
  });

  it("plain spaghetti dishes stay Italian", () => {
    expect(
      inferRecipeTaxonomy({
        title: "Spaghetti with Simple Tomato Sauce",
        tags: ["pasta"],
        ingredients: ings("Spaghetti", "Canned diced tomatoes"),
      }).cuisine
    ).toBe("Italian");
  });

  it("Pancakes are breakfast, not dessert", () => {
    const t = inferRecipeTaxonomy({
      title: "Pancakes",
      tags: ["staple", "classic", "baking"],
      ingredients: ings("Flour", "Milk", "Eggs", "Butter", "Sugar"),
    });
    expect(t.course).toBe("breakfast");
    expect(t.foodCategories).not.toContain("dessert");
  });

  it("steps words never add categories (minutes/pieces/repeat)", () => {
    const t = inferRecipeTaxonomy({
      title: "Scrambled Eggs",
      tags: ["breakfast"],
      ingredients: ings("Eggs", "Butter", "Milk", "Salt", "Black pepper"),
      steps: ["Whisk for 1 minute.", "Cut into pieces.", "Repeat."],
    });
    expect([...t.foodCategories].sort()).toEqual(["dairy", "egg"]);
  });

  it("vegetable oil / black pepper are not vegetables; bell pepper is", () => {
    expect(
      inferRecipeTaxonomy({
        title: "Boiled / Steamed Rice",
        tags: ["rice", "side"],
        ingredients: ings("White rice", "Salt", "Vegetable oil"),
      }).foodCategories
    ).toEqual(["grain"]);
    expect(
      inferRecipeTaxonomy({
        title: "Stir-Fry",
        ingredients: ings("Bell pepper", "Rice"),
      }).foodCategories
    ).toContain("vegetable");
  });

  it("Hamantaschen: dessert with nut (walnuts), no legume from 'Repeat'", () => {
    const t = inferRecipeTaxonomy({
      title: "Great-Grandmother Bubbie's Hamantaschen",
      ingredients: ings("pitted prunes", "dried apricots", "eggs", "flour", "chopped walnuts"),
      steps: ["Repeat with remaining dough."],
    });
    expect(t.course).toBe("dessert");
    expect(t.origins).toEqual(["jewish", "ashkenazi-jewish"]);
    expect(t.foodCategories).toEqual(
      expect.arrayContaining(["dessert", "egg", "grain", "fruit", "nut"])
    );
    expect(t.foodCategories).not.toContain("legume");
  });

  it("kimchi fried rice with bacon: Korean, pork, no nut from minutes", () => {
    const t = inferRecipeTaxonomy({
      title: "Kimchi-Bokkeumbap (Kimchi Fried Rice)",
      ingredients: ings("bacon, diced", "spicy kimchi", "white rice", "eggs"),
      steps: ["Fry 3 minutes."],
    });
    expect(t.cuisine).toBe("Korean");
    expect(t.meatType).toBe("pork");
    expect(t.foodCategories).not.toContain("nut");
  });

  it("title ramen still reads as Japanese; instant ramen in ingredients alone does not", () => {
    expect(inferRecipeTaxonomy({ title: "Tonkotsu Ramen" }).cuisine).toBe("Japanese");
    expect(
      inferRecipeTaxonomy({
        title: "Cheesy Noodle Bake",
        ingredients: ings("instant ramen noodles", "cheddar cheese"),
      }).cuisine
    ).not.toBe("Japanese");
  });
});

describe("allergens: plural + non-dairy compounds", () => {
  it("peanut butter / coconut milk are not milk; butter is", () => {
    expect(inferAllergenTags({ ingredients: ["Peanut butter", "Soy sauce"] })).not.toContain(
      "milk"
    );
    expect(inferAllergenTags({ ingredients: ["coconut milk"] })).not.toContain("milk");
    expect(inferAllergenTags({ ingredients: ["unsalted butter"] })).toContain("milk");
    expect(inferAllergenTags({ ingredients: ["buttermilk"] })).toContain("milk");
  });

  it("named cheeses and pasta shapes are detected", () => {
    const a = inferAllergenTags({ ingredients: ["12 oz Spaghetti", "1 oz Parmesan"] });
    expect(a).toEqual(expect.arrayContaining(["milk", "wheat"]));
    expect(inferDietaryEligibility({ ingredients: ["Spaghetti", "Parmesan"] }).veganEligible).toBe(
      false
    );
  });

  it("plural nuts / shellfish / fish are detected", () => {
    expect(inferAllergenTags({ ingredients: ["chopped walnuts"] })).toContain("tree_nuts");
    expect(inferAllergenTags({ ingredients: ["prawns"] })).toContain("shellfish");
    expect(inferAllergenTags({ ingredients: ["anchovies"] })).toContain("fish");
  });
});

describe("dietary inference: plural + non-dairy compounds", () => {
  it("peanut-butter noodles are vegan", () => {
    const d = inferDietaryEligibility({
      ingredients: ["Spaghetti", "Peanut butter", "Soy sauce", "Cabbage"],
    });
    expect(d.veganEligible).toBe(true);
    expect(d.vegetarianEligible).toBe(true);
  });

  it("bacon kills kosher/halal/vegetarian/pescatarian", () => {
    const d = inferDietaryEligibility({ ingredients: ["bacon, diced", "kimchi", "rice"] });
    expect(d).toMatchObject({
      kosherEligible: false,
      halalEligible: false,
      vegetarianEligible: false,
      pescatarianEligible: false,
    });
  });

  it("prawns are not kosher; mirin is not halal", () => {
    expect(inferDietaryEligibility({ ingredients: ["prawns"] }).kosherEligible).toBe(false);
    expect(inferDietaryEligibility({ ingredients: ["Mirin", "ground beef"] }).halalEligible).toBe(
      false
    );
  });

  it("meat + peanut butter is not a meat/dairy conflict", () => {
    expect(recipeHasMeatAndDairy({ ingredients: ["chicken", "peanut butter"] })).toBe(false);
    expect(recipeHasMeatAndDairy({ ingredients: ["beef", "cheddar"] })).toBe(true);
  });

  it("stripNonDairyPhrases keeps real dairy", () => {
    expect(stripNonDairyPhrases("peanut butter and butter")).not.toMatch(/peanut/);
    expect(stripNonDairyPhrases("peanut butter and butter")).toMatch(/\bbutter\b/);
  });
});
