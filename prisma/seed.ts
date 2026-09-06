import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateInviteCode } from "../src/lib/household";
import {
  needsMealDbImage,
  resolveRecipeImageUrl,
} from "../src/lib/recipe-image";
import { cloneStapleRecipesToHousehold } from "../src/lib/clone-staples";

const prisma = new PrismaClient();

function j(arr: string[]) {
  return JSON.stringify(arr);
}

async function main() {
  const forceReset = process.env.FF_FORCE_RESET === "1";

  if (forceReset) {
    console.warn(
      "FF_FORCE_RESET=1 — wiping users/recipes/households/pantry/coupons (intentional only)."
    );
    await prisma.session.deleteMany();
    await prisma.recipeFavorite.deleteMany().catch(() => {});
    await prisma.recipeShare.deleteMany().catch(() => {});
    await prisma.shoppingListItem.deleteMany().catch(() => {});
    await prisma.householdMember.deleteMany();
    await prisma.recipeIngredient.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.pantryItem.deleteMany();
    await prisma.coupon.deleteMany();
    await prisma.customPantryStaple.deleteMany().catch(() => {});
    await prisma.household.deleteMany();
    await prisma.user.deleteMany();
  } else {
    console.log(
      "Non-destructive seed: upserting demo staples only when missing (set FF_FORCE_RESET=1 to wipe)."
    );
  }

  const pantry = [
    { name: "White rice", quantity: 4, unit: "cups", category: "Grains", tags: j(["staple", "struggle"]) },
    { name: "Eggs", quantity: 12, unit: "each", category: "Proteins", tags: j(["staple", "struggle"]) },
    { name: "Canned tuna", quantity: 2, unit: "cans", category: "Canned", tags: j(["staple", "struggle"]) },
    { name: "Yellow onion", quantity: 3, unit: "each", category: "Produce", tags: j(["staple"]) },
    { name: "Garlic", quantity: 1, unit: "head", category: "Produce", tags: j(["staple", "flavor"]) },
    { name: "Potatoes", quantity: 5, unit: "each", category: "Produce", tags: j(["staple", "struggle"]) },
    { name: "Carrots", quantity: 4, unit: "each", category: "Produce", tags: j([]) },
    { name: "Green cabbage", quantity: 1, unit: "head", category: "Produce", tags: j(["struggle"]) },
    { name: "Soy sauce", quantity: 1, unit: "bottle", category: "Oils & Condiments", tags: j(["flavor", "booster"]) },
    { name: "White vinegar", quantity: 1, unit: "bottle", category: "Oils & Condiments", tags: j(["flavor", "booster"]) },
    { name: "Vegetable oil", quantity: 1, unit: "bottle", category: "Oils & Condiments", tags: j(["staple"]) },
    { name: "Peanut butter", quantity: 1, unit: "jar", category: "Proteins", tags: j(["struggle", "flavor"]) },
    { name: "Chili flakes", quantity: 1, unit: "jar", category: "Spices", tags: j(["flavor", "booster"]) },
    { name: "Salt", quantity: 1, unit: "box", category: "Spices", tags: j(["staple"]) },
    { name: "Black pepper", quantity: 1, unit: "jar", category: "Spices", tags: j(["staple"]) },
    { name: "Flour tortillas", quantity: 10, unit: "each", category: "Grains", tags: j([]) },
    { name: "Cheddar cheese", quantity: 8, unit: "oz", category: "Dairy", tags: j([]) },
  ];

  const recipes = [
    {
      title: "Garlic Fried Rice with Crispy Egg",
      description:
        "Day-old rice energy. A glossy soy finish and a crispy-edged egg make it feel like takeout.",
      costTier: "cheap",
      tags: j(["struggle", "rice", "egg", "15-min"]),
      servings: 2,
      cookTimeMinutes: 15,
      isStruggleMeal: true,
      techniqueTips: j([
        "Use cold leftover rice so it fries instead of steams.",
        "Don't move the egg too early — let the edges lace and crisp.",
      ]),
      flavorBoosters: j(["soy sauce", "garlic", "chili flakes", "vinegar splash"]),
      steps: j([
        "Mince garlic. Heat oil in a wide pan until shimmering.",
        "Fry garlic until fragrant and lightly golden; add cold rice and break up clumps.",
        "Season with soy sauce and pepper; toss until hot and a little toasty.",
        "In a second pan, fry eggs in oil until edges are crispy and whites set.",
        "Plate rice, crown with egg, finish with chili flakes and a drop of vinegar.",
      ]),
      ingredients: [
        { name: "White rice", quantity: 2, unit: "cups" },
        { name: "Eggs", quantity: 2, unit: "each" },
        { name: "Garlic", quantity: 3, unit: "cloves" },
        { name: "Soy sauce", quantity: 2, unit: "tbsp" },
        { name: "Vegetable oil", quantity: 2, unit: "tbsp" },
        { name: "Chili flakes", quantity: 0.5, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Smoky Beans & Rice Bowl",
      description:
        "Complete protein, complete comfort. Onion and chili do the heavy lifting.",
      costTier: "cheap",
      tags: j(["struggle", "beans", "rice", "one-bowl"]),
      servings: 4,
      cookTimeMinutes: 45,
      isStruggleMeal: true,
      techniqueTips: j([
        "Brown the onion past translucent — that's where sweetness lives.",
        "Mash a scoop of beans into the pot for instant body.",
      ]),
      flavorBoosters: j(["chili flakes", "garlic", "vinegar", "black pepper"]),
      steps: j([
        "Cook rice. Meanwhile, sauté diced onion in oil until deep golden.",
        "Add garlic and chili flakes; cook 30 seconds.",
        "Add beans with a splash of water; simmer 10 minutes. Mash some beans.",
        "Season with salt, pepper, and a splash of vinegar.",
        "Serve beans over rice. Proud plate optional but recommended.",
      ]),
      ingredients: [
        { name: "White rice", quantity: 2, unit: "cups" },
        { name: "Dry black beans", quantity: 1.5, unit: "cups" },
        { name: "Yellow onion", quantity: 1, unit: "each" },
        { name: "Garlic", quantity: 3, unit: "cloves" },
        { name: "Vegetable oil", quantity: 1, unit: "tbsp" },
        { name: "Chili flakes", quantity: 0.5, unit: "tsp", optional: true },
        { name: "White vinegar", quantity: 1, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Pantry Tuna Pasta",
      description:
        "Canned tuna + tomatoes + spaghetti. Brighten with vinegar like you meant it.",
      costTier: "cheap",
      tags: j(["struggle", "pasta", "canned", "weeknight"]),
      servings: 3,
      cookTimeMinutes: 25,
      isStruggleMeal: true,
      techniqueTips: j([
        "Save pasta water — starch is free sauce insurance.",
        "Bloom garlic in oil before tomatoes hit the pan.",
      ]),
      flavorBoosters: j(["garlic", "chili flakes", "vinegar", "black pepper"]),
      steps: j([
        "Boil spaghetti in salted water until al dente; reserve 1/2 cup pasta water.",
        "Sauté garlic and chili in oil; add tomatoes and simmer 8 minutes.",
        "Stir in drained tuna; loosen with pasta water.",
        "Toss in pasta; finish with vinegar and lots of black pepper.",
      ]),
      ingredients: [
        { name: "Spaghetti", quantity: 12, unit: "oz" },
        { name: "Canned tuna", quantity: 2, unit: "cans" },
        { name: "Canned diced tomatoes", quantity: 1, unit: "can" },
        { name: "Garlic", quantity: 3, unit: "cloves" },
        { name: "Vegetable oil", quantity: 2, unit: "tbsp" },
        { name: "Chili flakes", quantity: 0.5, unit: "tsp", optional: true },
        { name: "White vinegar", quantity: 1, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Crispy Potato Hash with Eggs",
      description: "Cubed potatoes, hard sear, soft eggs. Breakfast-for-dinner royalty.",
      costTier: "cheap",
      tags: j(["struggle", "potato", "egg", "brunch"]),
      servings: 2,
      cookTimeMinutes: 30,
      isStruggleMeal: true,
      techniqueTips: j([
        "Dry potatoes well and don't crowd the pan — crowding steams.",
        "Salt early so potatoes season through.",
      ]),
      flavorBoosters: j(["onion", "black pepper", "chili flakes"]),
      steps: j([
        "Dice potatoes small; pat dry. Dice onion.",
        "Heat oil in a skillet; add potatoes in a single layer. Leave them alone until browned.",
        "Add onion; cook until soft and potatoes are tender.",
        "Season aggressively. Make wells and crack in eggs; cover until whites set.",
      ]),
      ingredients: [
        { name: "Potatoes", quantity: 3, unit: "each" },
        { name: "Eggs", quantity: 2, unit: "each" },
        { name: "Yellow onion", quantity: 0.5, unit: "each" },
        { name: "Vegetable oil", quantity: 2, unit: "tbsp" },
        { name: "Salt", quantity: 1, unit: "tsp" },
        { name: "Black pepper", quantity: 0.5, unit: "tsp" },
      ],
    },
    {
      title: "Peanut-Cabbage Noodle Stir",
      description:
        "Unconventional pairing that tastes intentional: creamy peanut, crunchy cabbage, soy-vinegar glaze.",
      costTier: "cheap",
      tags: j(["struggle", "creative", "cabbage", "pasta"]),
      servings: 2,
      cookTimeMinutes: 20,
      isStruggleMeal: true,
      techniqueTips: j([
        "Thin peanut butter with hot pasta water before it hits the pan.",
        "Keep cabbage crisp — 2–3 minutes max.",
      ]),
      flavorBoosters: j(["soy sauce", "vinegar", "chili flakes", "garlic"]),
      steps: j([
        "Cook spaghetti; reserve hot water. Shred cabbage.",
        "Whisk peanut butter with soy, vinegar, chili, and a splash of pasta water.",
        "Stir-fry garlic and cabbage in oil 2–3 minutes.",
        "Add noodles and sauce; toss until glossy. Adjust with more water or soy.",
      ]),
      ingredients: [
        { name: "Spaghetti", quantity: 8, unit: "oz" },
        { name: "Green cabbage", quantity: 0.25, unit: "head" },
        { name: "Peanut butter", quantity: 3, unit: "tbsp" },
        { name: "Soy sauce", quantity: 2, unit: "tbsp" },
        { name: "White vinegar", quantity: 1, unit: "tbsp" },
        { name: "Garlic", quantity: 2, unit: "cloves" },
        { name: "Vegetable oil", quantity: 1, unit: "tbsp" },
        { name: "Chili flakes", quantity: 0.5, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Cheesy Egg Tortilla Melts",
      description: "Two tortillas, scrambled eggs, melted cheddar. Diner vibes, tiny budget.",
      costTier: "cheap",
      tags: j(["breakfast", "egg", "quick"]),
      servings: 2,
      cookTimeMinutes: 15,
      isStruggleMeal: true,
      techniqueTips: j([
        "Low heat for eggs — creamy beats rubbery.",
        "Press the melt briefly so cheese seals the deal.",
      ]),
      flavorBoosters: j(["black pepper", "hot sauce if you have it"]),
      steps: j([
        "Scramble eggs softly with salt and pepper.",
        "Warm tortillas; add eggs and cheese; fold or stack.",
        "Toast in a dry pan until cheese melts.",
      ]),
      ingredients: [
        { name: "Eggs", quantity: 3, unit: "each" },
        { name: "Flour tortillas", quantity: 2, unit: "each" },
        { name: "Cheddar cheese", quantity: 2, unit: "oz" },
        { name: "Vegetable oil", quantity: 1, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Carrot-Onion Tomato Soup",
      description: "Blender optional. Soft vegetables, canned tomatoes, humble and warming.",
      costTier: "cheap",
      tags: j(["soup", "vegetarian", "comfort"]),
      servings: 4,
      cookTimeMinutes: 40,
      isStruggleMeal: false,
      techniqueTips: j([
        "Sweat onions with a pinch of salt to draw out sweetness.",
        "A splash of vinegar at the end wakes up canned tomatoes.",
      ]),
      flavorBoosters: j(["garlic", "vinegar", "black pepper"]),
      steps: j([
        "Sauté onion and carrot in oil until soft.",
        "Add garlic, then tomatoes and water; simmer 20 minutes.",
        "Mash or blend partially. Season with salt, pepper, vinegar.",
      ]),
      ingredients: [
        { name: "Yellow onion", quantity: 1, unit: "each" },
        { name: "Carrots", quantity: 3, unit: "each" },
        { name: "Canned diced tomatoes", quantity: 2, unit: "cans" },
        { name: "Garlic", quantity: 2, unit: "cloves" },
        { name: "Vegetable oil", quantity: 1, unit: "tbsp" },
        { name: "White vinegar", quantity: 1, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Lemon-Garlic Butter Pasta",
      description:
        "Moderate-tier only because butter feels fancy — still weeknight easy. Uses pantry pasta.",
      costTier: "moderate",
      tags: j(["pasta", "bright", "date-night-cheap"]),
      servings: 2,
      cookTimeMinutes: 20,
      isStruggleMeal: false,
      techniqueTips: j([
        "Emulsify with pasta water — sauce should coat, not pool.",
      ]),
      flavorBoosters: j(["garlic", "black pepper", "lemon if available"]),
      steps: j([
        "Cook pasta. Melt butter with garlic on low heat.",
        "Toss pasta with butter, pepper, and pasta water until silky.",
        "Finish with vinegar or lemon if you have it.",
      ]),
      ingredients: [
        { name: "Spaghetti", quantity: 8, unit: "oz" },
        { name: "Garlic", quantity: 3, unit: "cloves" },
        { name: "Butter", quantity: 2, unit: "tbsp" },
        { name: "Black pepper", quantity: 1, unit: "tsp" },
        { name: "White vinegar", quantity: 1, unit: "tsp", optional: true },
      ],
    },
    // --- Classic staple starter pack (cloned into new households) ---
    {
      title: "Classic Apple Pie",
      description:
        "Flaky double crust, cinnamon-sugar apples — the Sunday dessert everyone should know.",
      costTier: "moderate",
      tags: j(["staple", "classic", "dessert", "baking"]),
      servings: 8,
      cookTimeMinutes: 75,
      isStruggleMeal: false,
      techniqueTips: j([
        "Keep butter cold so the crust stays flaky.",
        "Vent the top crust so steam escapes and the filling thickens.",
      ]),
      flavorBoosters: j(["cinnamon", "lemon juice", "pinch of salt in filling"]),
      steps: j([
        "Make or thaw two pie crusts. Preheat oven to 425°F (220°C).",
        "Toss peeled, sliced apples with sugar, cinnamon, flour, and a squeeze of lemon.",
        "Line a pie dish with bottom crust; pile in apples; dot with butter.",
        "Cover with top crust, crimp edges, cut vents; brush with egg wash if you like.",
        "Bake 15 minutes hot, then reduce to 350°F (175°C) and bake 35–45 minutes until golden and bubbling.",
        "Cool at least 1 hour so slices hold.",
      ]),
      ingredients: [
        { name: "Apple", quantity: 6, unit: "each" },
        { name: "Flour", quantity: 2.5, unit: "cups" },
        { name: "Butter", quantity: 8, unit: "oz" },
        { name: "Sugar", quantity: 0.75, unit: "cups" },
        { name: "Cinnamon", quantity: 1, unit: "tsp" },
        { name: "Lemon", quantity: 0.5, unit: "each", optional: true },
        { name: "Eggs", quantity: 1, unit: "each", optional: true },
        { name: "Salt", quantity: 0.5, unit: "tsp" },
      ],
    },
    {
      title: "Scrambled Eggs",
      description: "Soft, creamy curds — breakfast foundation and 5-minute dinner backup.",
      costTier: "cheap",
      tags: j(["staple", "classic", "breakfast", "egg", "quick"]),
      servings: 2,
      cookTimeMinutes: 8,
      isStruggleMeal: false,
      techniqueTips: j([
        "Low-medium heat; pull early — residual heat finishes them.",
        "A splash of milk or water keeps curds tender.",
      ]),
      flavorBoosters: j(["butter", "black pepper", "chives if you have them"]),
      steps: j([
        "Beat eggs with a pinch of salt and optional splash of milk.",
        "Melt butter in a nonstick pan over medium-low heat.",
        "Pour in eggs; stir gently with a spatula, folding soft curds.",
        "Remove from heat while still slightly glossy. Pepper and serve.",
      ]),
      ingredients: [
        { name: "Eggs", quantity: 4, unit: "each" },
        { name: "Butter", quantity: 1, unit: "tbsp" },
        { name: "Milk", quantity: 2, unit: "tbsp", optional: true },
        { name: "Salt", quantity: 0.25, unit: "tsp" },
        { name: "Black pepper", quantity: 0.25, unit: "tsp" },
      ],
    },
    {
      title: "Boiled / Steamed Rice",
      description: "Reliable pot of fluffy white rice — the canvas for almost every cuisine.",
      costTier: "cheap",
      tags: j(["staple", "classic", "rice", "side"]),
      servings: 4,
      cookTimeMinutes: 25,
      isStruggleMeal: false,
      techniqueTips: j([
        "Rinse until water runs clearer for less sticky grains.",
        "Lid on, no peeking during the steam rest.",
      ]),
      flavorBoosters: j(["pinch of salt", "bay leaf", "a drop of oil"]),
      steps: j([
        "Rinse 1 cup rice until water is mostly clear.",
        "Combine rice with 1.5–2 cups water and a pinch of salt in a pot.",
        "Bring to a boil, cover, reduce to lowest heat; cook 15–18 minutes.",
        "Turn off heat; rest covered 5–10 minutes. Fluff with a fork.",
      ]),
      ingredients: [
        { name: "White rice", quantity: 1, unit: "cups" },
        { name: "Salt", quantity: 0.25, unit: "tsp", optional: true },
        { name: "Vegetable oil", quantity: 0.5, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Spaghetti with Simple Tomato Sauce",
      description: "Garlic, olive oil, canned tomatoes — the weeknight pasta that never fails.",
      costTier: "cheap",
      tags: j(["staple", "classic", "pasta", "weeknight"]),
      servings: 4,
      cookTimeMinutes: 30,
      isStruggleMeal: false,
      techniqueTips: j([
        "Salt pasta water like the sea.",
        "Save pasta water to loosen and gloss the sauce.",
      ]),
      flavorBoosters: j(["garlic", "oregano", "chili flakes", "parmesan"]),
      steps: j([
        "Boil spaghetti in well-salted water until al dente; reserve 1/2 cup pasta water.",
        "Warm olive oil; gently cook sliced garlic until fragrant (not browned).",
        "Add canned tomatoes, salt, oregano; simmer 10–15 minutes.",
        "Toss pasta with sauce and pasta water until coated. Finish with pepper and cheese if you have it.",
      ]),
      ingredients: [
        { name: "Spaghetti", quantity: 12, unit: "oz" },
        { name: "Canned diced tomatoes", quantity: 1, unit: "cans" },
        { name: "Garlic", quantity: 3, unit: "cloves" },
        { name: "Olive oil", quantity: 2, unit: "tbsp" },
        { name: "Oregano", quantity: 1, unit: "tsp", optional: true },
        { name: "Chili flakes", quantity: 0.25, unit: "tsp", optional: true },
        { name: "Parmesan", quantity: 1, unit: "oz", optional: true },
        { name: "Salt", quantity: 1, unit: "tsp" },
      ],
    },
    {
      title: "Grilled Cheese",
      description: "Crispy buttered bread, molten cheese — childhood classic, adult comfort.",
      costTier: "cheap",
      tags: j(["staple", "classic", "sandwich", "quick"]),
      servings: 1,
      cookTimeMinutes: 10,
      isStruggleMeal: false,
      techniqueTips: j([
        "Medium-low heat so cheese melts before bread burns.",
        "Butter the outside of the bread, not the pan, for even browning.",
      ]),
      flavorBoosters: j(["sharp cheddar", "pinch of garlic powder", "tomato soup on the side"]),
      steps: j([
        "Butter one side of each bread slice.",
        "Place cheese between unbuttered sides; buttered sides face out.",
        "Cook in a skillet over medium-low until golden; flip and finish until cheese melts.",
        "Rest 30 seconds, slice, serve.",
      ]),
      ingredients: [
        { name: "Bread", quantity: 2, unit: "each" },
        { name: "Cheddar cheese", quantity: 2, unit: "oz" },
        { name: "Butter", quantity: 1, unit: "tbsp" },
      ],
    },
    {
      title: "Simple Chicken Soup",
      description: "Chicken, aromatics, broth — restorative bowl you can make from almost nothing.",
      costTier: "cheap",
      tags: j(["staple", "classic", "soup", "comfort"]),
      servings: 6,
      cookTimeMinutes: 60,
      isStruggleMeal: false,
      techniqueTips: j([
        "Simmer gently — a hard boil clouds the broth.",
        "Salt in stages; broth concentrates as it reduces.",
      ]),
      flavorBoosters: j(["bay leaf", "black pepper", "garlic", "parsley"]),
      steps: j([
        "In a pot, combine chicken, onion, carrot, celery, garlic, and water or broth.",
        "Bring to a simmer; skim foam. Season lightly; cook 35–45 minutes until chicken is tender.",
        "Remove chicken; shred meat; discard bones/skin if using bone-in.",
        "Return meat to pot; adjust salt and pepper. Optional: add cooked rice or noodles.",
      ]),
      ingredients: [
        { name: "Chicken thighs", quantity: 1.5, unit: "lb" },
        { name: "Yellow onion", quantity: 1, unit: "each" },
        { name: "Carrot", quantity: 2, unit: "each" },
        { name: "Celery", quantity: 2, unit: "each" },
        { name: "Garlic", quantity: 2, unit: "cloves" },
        { name: "Chicken broth", quantity: 4, unit: "cups", optional: true },
        { name: "Bay leaves", quantity: 1, unit: "each", optional: true },
        { name: "Salt", quantity: 1, unit: "tsp" },
        { name: "Black pepper", quantity: 0.5, unit: "tsp" },
      ],
    },
    {
      title: "Pancakes",
      description: "Fluffy buttermilk-style pancakes from pantry staples — weekend morning classic.",
      costTier: "cheap",
      tags: j(["staple", "classic", "breakfast", "baking"]),
      servings: 4,
      cookTimeMinutes: 25,
      isStruggleMeal: false,
      techniqueTips: j([
        "Do not overmix — lumpy batter means tender cakes.",
        "Wait for bubbles on top before flipping.",
      ]),
      flavorBoosters: j(["vanilla", "cinnamon", "butter and syrup"]),
      steps: j([
        "Whisk flour, sugar, baking powder, and salt.",
        "In another bowl mix milk, egg, melted butter, and vanilla.",
        "Combine wet into dry until just mixed.",
        "Cook scoops on a lightly greased medium pan until bubbles form; flip once.",
      ]),
      ingredients: [
        { name: "Flour", quantity: 1.5, unit: "cups" },
        { name: "Milk", quantity: 1.25, unit: "cups" },
        { name: "Eggs", quantity: 1, unit: "each" },
        { name: "Butter", quantity: 2, unit: "tbsp" },
        { name: "Sugar", quantity: 2, unit: "tbsp" },
        { name: "Baking powder", quantity: 2, unit: "tsp" },
        { name: "Salt", quantity: 0.5, unit: "tsp" },
        { name: "Vanilla extract", quantity: 1, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Basic Roast Chicken",
      description: "Salt, pepper, hot oven — golden bird that feeds a household for days.",
      costTier: "moderate",
      tags: j(["staple", "classic", "chicken", "roast"]),
      servings: 4,
      cookTimeMinutes: 90,
      isStruggleMeal: false,
      techniqueTips: j([
        "Pat the skin dry; salt generously at least 30 minutes ahead if you can.",
        "Rest 10–15 minutes before carving so juices stay in.",
      ]),
      flavorBoosters: j(["garlic", "lemon in the cavity", "olive oil rub"]),
      steps: j([
        "Preheat oven to 425°F (220°C). Pat chicken dry; rub with oil, salt, and pepper.",
        "Optional: stuff cavity with lemon halves and garlic cloves.",
        "Roast breast-side up on a rack or bed of onion ~60–75 minutes until juices run clear / 165°F in the thigh.",
        "Rest, carve, serve with pan juices.",
      ]),
      ingredients: [
        { name: "Whole chicken", quantity: 1, unit: "each" },
        { name: "Olive oil", quantity: 1, unit: "tbsp" },
        { name: "Salt", quantity: 1.5, unit: "tsp" },
        { name: "Black pepper", quantity: 1, unit: "tsp" },
        { name: "Yellow onion", quantity: 1, unit: "each", optional: true },
        { name: "Lemon", quantity: 1, unit: "each", optional: true },
        { name: "Garlic", quantity: 4, unit: "cloves", optional: true },
      ],
    },
    {
      title: "Mashed Potatoes",
      description: "Buttery, creamy mash — the side that makes any plate feel complete.",
      costTier: "cheap",
      tags: j(["staple", "classic", "potato", "side"]),
      servings: 4,
      cookTimeMinutes: 30,
      isStruggleMeal: false,
      techniqueTips: j([
        "Start potatoes in cold salted water for even cooking.",
        "Warm milk/butter before folding in so mash stays fluffy.",
      ]),
      flavorBoosters: j(["garlic", "black pepper", "sour cream"]),
      steps: j([
        "Peel and chunk potatoes; cover with cold salted water; boil until tender.",
        "Drain well. Mash with butter and warm milk until creamy.",
        "Season with salt and pepper. Optional: fold in sour cream or roasted garlic.",
      ]),
      ingredients: [
        { name: "Potato", quantity: 2, unit: "lb" },
        { name: "Butter", quantity: 4, unit: "tbsp" },
        { name: "Milk", quantity: 0.5, unit: "cups" },
        { name: "Salt", quantity: 1, unit: "tsp" },
        { name: "Black pepper", quantity: 0.5, unit: "tsp" },
        { name: "Sour cream", quantity: 2, unit: "tbsp", optional: true },
      ],
    },
    {
      title: "Chocolate Chip Cookies",
      description: "Chewy edges, soft centers — the bake-sale classic every kitchen should own.",
      costTier: "cheap",
      tags: j(["staple", "classic", "dessert", "baking", "cookies"]),
      servings: 24,
      cookTimeMinutes: 35,
      isStruggleMeal: false,
      techniqueTips: j([
        "Cream butter and sugar until light for better lift.",
        "Chill dough 20 minutes if cookies spread too much.",
      ]),
      flavorBoosters: j(["vanilla", "flaky salt on top", "brown sugar if you have it"]),
      steps: j([
        "Preheat oven to 375°F (190°C). Cream butter with sugars; beat in egg and vanilla.",
        "Mix in flour, baking soda, and salt; fold in chocolate chips.",
        "Scoop onto a lined sheet; bake 9–11 minutes until edges are golden.",
        "Cool on the sheet 2 minutes, then transfer.",
      ]),
      ingredients: [
        { name: "Flour", quantity: 2.25, unit: "cups" },
        { name: "Butter", quantity: 8, unit: "oz" },
        { name: "Sugar", quantity: 1.5, unit: "cups" },
        { name: "Eggs", quantity: 2, unit: "each" },
        { name: "Chocolate chips", quantity: 12, unit: "oz" },
        { name: "Vanilla extract", quantity: 1, unit: "tsp" },
        { name: "Baking soda", quantity: 1, unit: "tsp" },
        { name: "Salt", quantity: 0.5, unit: "tsp" },
      ],
    },
    {
      title: "Veg & Protein Stir-Fry",
      description: "Template stir-fry: hot pan, crisp veg, any protein, soy-garlic glaze.",
      costTier: "cheap",
      tags: j(["staple", "classic", "stir-fry", "weeknight", "template"]),
      servings: 4,
      cookTimeMinutes: 25,
      isStruggleMeal: false,
      techniqueTips: j([
        "Everything cut and sauce mixed before the pan gets hot.",
        "High heat, short cook — veg should stay bright.",
      ]),
      flavorBoosters: j(["garlic", "ginger if available", "chili flakes", "sesame oil finish"]),
      steps: j([
        "Slice protein thin; cut veg into bite-size pieces. Mix soy, garlic, and a pinch of sugar.",
        "Sear protein in hot oil; set aside when just cooked.",
        "Stir-fry harder veg first, then softer; return protein.",
        "Pour sauce; toss 30–60 seconds. Serve over rice.",
      ]),
      ingredients: [
        { name: "Chicken breast", quantity: 1, unit: "lb" },
        { name: "Broccoli", quantity: 1, unit: "each" },
        { name: "Bell pepper", quantity: 1, unit: "each" },
        { name: "Yellow onion", quantity: 0.5, unit: "each" },
        { name: "Garlic", quantity: 3, unit: "cloves" },
        { name: "Soy sauce", quantity: 3, unit: "tbsp" },
        { name: "Vegetable oil", quantity: 2, unit: "tbsp" },
        { name: "White rice", quantity: 2, unit: "cups", optional: true },
        { name: "Chili flakes", quantity: 0.25, unit: "tsp", optional: true },
      ],
    },
    {
      title: "Chili / Taco Filling",
      description: "Seasoned ground beef with onion and spices — chili base or taco night filling.",
      costTier: "cheap",
      tags: j(["staple", "classic", "beef", "chili", "tacos"]),
      servings: 6,
      cookTimeMinutes: 40,
      isStruggleMeal: false,
      techniqueTips: j([
        "Brown the meat hard for flavor; drain excess fat if needed.",
        "Bloom spices in the fat before adding tomatoes/beans.",
      ]),
      flavorBoosters: j(["cumin", "chili flakes", "garlic", "splash of vinegar"]),
      steps: j([
        "Brown ground beef with diced onion; add garlic near the end.",
        "Stir in cumin, chili flakes, salt, and pepper.",
        "Add tomatoes and optional beans; simmer 15–20 minutes.",
        "Serve in bowls (chili) or with tortillas (tacos).",
      ]),
      ingredients: [
        { name: "Ground beef", quantity: 1, unit: "lb" },
        { name: "Yellow onion", quantity: 1, unit: "each" },
        { name: "Garlic", quantity: 2, unit: "cloves" },
        { name: "Canned diced tomatoes", quantity: 1, unit: "cans" },
        { name: "Canned black beans", quantity: 1, unit: "cans", optional: true },
        { name: "Cumin", quantity: 1, unit: "tsp" },
        { name: "Chili flakes", quantity: 0.5, unit: "tsp" },
        { name: "Flour tortillas", quantity: 8, unit: "each", optional: true },
        { name: "Salt", quantity: 1, unit: "tsp" },
      ],
    },
    {
      title: "Banana Bread",
      description: "Ripe bananas, one bowl — the loaf that turns freckled fruit into breakfast.",
      costTier: "cheap",
      tags: j(["staple", "classic", "dessert", "baking", "banana"]),
      servings: 10,
      cookTimeMinutes: 70,
      isStruggleMeal: false,
      techniqueTips: j([
        "The browner the bananas, the sweeter the loaf.",
        "Do not overmix once flour goes in.",
      ]),
      flavorBoosters: j(["cinnamon", "vanilla", "chocolate chips"]),
      steps: j([
        "Preheat oven to 350°F (175°C). Grease a loaf pan.",
        "Mash bananas; mix with melted butter, sugar, egg, and vanilla.",
        "Stir in flour, baking soda, salt, and optional cinnamon.",
        "Bake 50–60 minutes until a toothpick comes out clean. Cool before slicing.",
      ]),
      ingredients: [
        { name: "Banana", quantity: 3, unit: "each" },
        { name: "Flour", quantity: 1.5, unit: "cups" },
        { name: "Butter", quantity: 3, unit: "oz" },
        { name: "Sugar", quantity: 0.75, unit: "cups" },
        { name: "Eggs", quantity: 1, unit: "each" },
        { name: "Baking soda", quantity: 1, unit: "tsp" },
        { name: "Salt", quantity: 0.25, unit: "tsp" },
        { name: "Vanilla extract", quantity: 1, unit: "tsp", optional: true },
        { name: "Cinnamon", quantity: 0.5, unit: "tsp", optional: true },
      ],
    },
  ];


  // Ensure demo pantry (null household) by name — never delete user items
  let pantryCreated = 0;
  for (const item of pantry) {
    const existing = await prisma.pantryItem.findFirst({
      where: { name: item.name, householdId: null },
    });
    if (!existing) {
      await prisma.pantryItem.create({ data: item });
      pantryCreated += 1;
    }
  }

  let recipesCreated = 0;
  let recipesImaged = 0;
  for (const r of recipes) {
    const { ingredients, ...rest } = r;
    const existing = await prisma.recipe.findFirst({
      where: { title: rest.title, householdId: null },
      include: { ingredients: true },
    });
    if (!existing) {
      const imageUrl = await resolveRecipeImageUrl({
        title: rest.title,
        preferDeterministicFallback: true,
      });
      await prisma.recipe.create({
        data: {
          ...rest,
          visibility: "public",
          imageUrl,
          ingredients: {
            create: ingredients.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
              optional: "optional" in i ? Boolean(i.optional) : false,
            })),
          },
        },
      });
      recipesCreated += 1;
    } else if (needsMealDbImage(existing.imageUrl)) {
      const imageUrl = await resolveRecipeImageUrl({
        title: rest.title,
        preferDeterministicFallback: true,
      });
      if (imageUrl && imageUrl !== existing.imageUrl) {
        await prisma.recipe.update({
          where: { id: existing.id },
          data: { imageUrl },
        });
        recipesImaged += 1;
      }
    }
  }

  const coupons = [
    {
      brand: "Sunrise Grains",
      title: "Any Sunrise rice 2 lb+",
      discountText: "$1.00 OFF",
      terms: "One coupon per purchase. Valid on Sunrise white or brown rice 2 lb or larger. Not stackable with other Sunrise offers. Demo only.",
      codeValue: "SUNRISE-RICE-100",
      codeType: "qr",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      clipped: true,
    },
    {
      brand: "Valley Beans Co.",
      title: "Black, pinto, or dry beans (canned or bag)",
      discountText: "BOGO 50% OFF",
      terms: "Buy one can, get second 50% off equal or lesser value. Limit 2. Demo manufacturer coupon.",
      codeValue: "812345678901",
      codeType: "barcode",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      clipped: false,
    },
    {
      brand: "Harbor Catch",
      title: "Chunk light tuna (5 oz)",
      discountText: "$0.75 OFF",
      terms: "Valid on Harbor Catch chunk light tuna 5 oz cans. Limit one. Demo only.",
      codeValue: "HARBOR-TUNA-75",
      codeType: "qr",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      clipped: true,
    },
    {
      brand: "Golden Nest",
      title: "Large eggs dozen",
      discountText: "$1.50 OFF",
      terms: "Any Golden Nest large grade A dozen. Cannot be combined with store card fuel offers. Demo.",
      codeValue: "GOLDEN-EGGS-150",
      codeType: "qr",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20),
      clipped: false,
    },
    {
      brand: "Al Dente Mill",
      title: "Any spaghetti or pasta 12 oz+",
      discountText: "$1.00 OFF",
      terms: "Valid on Al Dente spaghetti, penne, or elbows 12 oz or larger. One per purchase. Demo manufacturer coupon for missing-staple deals.",
      codeValue: "ALDENTE-PASTA-100",
      codeType: "qr",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 50),
      clipped: true,
    },
    {
      brand: "Red Jar Kitchen",
      title: "Pasta sauce or tomato sauce 24 oz",
      discountText: "$0.75 OFF",
      terms: "Any Red Jar pasta sauce or tomato sauce 24 oz. Limit one. Demo — matches missing tomato/sauce staples on struggle meals.",
      codeValue: "REDJAR-SAUCE-75",
      codeType: "barcode",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40),
      clipped: false,
    },
    {
      brand: "Meadow Creamery",
      title: "Salted or unsalted butter sticks",
      discountText: "$1.00 OFF",
      terms: "Meadow Creamery butter sticks (salted or unsalted). Demo coupon for Lemon-Garlic Butter Pasta near-miss.",
      codeValue: "MEADOW-BUTTER-100",
      codeType: "qr",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35),
      clipped: true,
    },
    {
      brand: "Spice Route",
      title: "Any Spice Route chili flakes",
      discountText: "FREE jar ≤ $2.50",
      terms: "Receive one Spice Route chili flakes jar up to $2.50 free with any $10 Spice Route purchase. Expired sample for filter demos.",
      codeValue: "SPICE-CHILI-FREE",
      codeType: "barcode",
      expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      clipped: false,
    },
    {
      brand: "Lumen Soy",
      title: "Lumen soy sauce 10 oz",
      discountText: "$0.50 OFF",
      terms: "One use. Mark used after redeem in app for demo tracking.",
      codeValue: "LUMEN-SOY-50",
      codeType: "qr",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90),
      clipped: false,
      used: true,
      usedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    },
  ];


  let couponsCreated = 0;
  for (const c of coupons) {
    const existing = await prisma.coupon.findFirst({
      where: { codeValue: c.codeValue, householdId: null },
    });
    if (!existing) {
      await prisma.coupon.create({ data: c });
      couponsCreated += 1;
    }
  }

  // Optional Pro demo user + household (upsert — never wipe other users)
  const proHash = await bcrypt.hash("prodemo", 10);
  const proUser = await prisma.user.upsert({
    where: { email: "pro@fridgeforge.local" },
    create: {
      email: "pro@fridgeforge.local",
      name: "Pro Demo",
      passwordHash: proHash,
      plan: "pro",
    },
    update: {
      plan: "pro",
      passwordHash: proHash,
    },
  });

  let household = await prisma.household.findFirst({
    where: {
      members: { some: { userId: proUser.id, role: "owner" } },
    },
  });
  let staplesCloned = 0;
  if (!household) {
    household = await prisma.household.create({
      data: {
        name: "Demo Pro Kitchen",
        inviteCode: generateInviteCode(),
        members: {
          create: { userId: proUser.id, role: "owner" },
        },
      },
    });
    staplesCloned = await cloneStapleRecipesToHousehold(prisma, household.id);
  }

  console.log(
    `Seed ensure: pantry +${pantryCreated}, recipes +${recipesCreated} (images refreshed ${recipesImaged}), coupons +${couponsCreated}. forceReset=${forceReset}`
  );
  console.log(
    `Demo Pro user: pro@fridgeforge.local / prodemo — household "${household.name}" invite ${household.inviteCode} (cloned ${staplesCloned} staples this run)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
