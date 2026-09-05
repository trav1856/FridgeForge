import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function j(arr: string[]) {
  return JSON.stringify(arr);
}

async function main() {
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.pantryItem.deleteMany();
  await prisma.coupon.deleteMany();

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

  for (const item of pantry) {
    await prisma.pantryItem.create({ data: item });
  }

  const recipes = [
    {
      title: "Garlic Fried Rice with Crispy Egg",
      description:
        "Day-old rice energy. A glossy soy finish and a crispy-edged egg make it feel like takeout.",
      costTier: "cheap",
      tags: j(["struggle", "rice", "egg", "15-min"]),
      servings: 2,
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
  ];

  for (const r of recipes) {
    const { ingredients, ...rest } = r;
    await prisma.recipe.create({
      data: {
        ...rest,
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

  for (const c of coupons) {
    await prisma.coupon.create({ data: c });
  }

  console.log(`Seeded ${pantry.length} pantry items, ${recipes.length} recipes, and ${coupons.length} coupons.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
