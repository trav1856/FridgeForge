import type { PantryCategory } from "./categories";

/** Units offered as presets on Manual pantry add. */
export const PANTRY_UNITS = [
  "each",
  "oz",
  "lb",
  "cups",
  "tbsp",
  "cans",
  "pack",
] as const;

export type PantryUnit = (typeof PANTRY_UNITS)[number];

export type CatalogItem = {
  name: string;
  defaultQty: number;
  defaultUnit: PantryUnit | string;
  category: PantryCategory;
};

/**
 * UI chips for category-first intake. Display labels may alias
 * PANTRY_CATEGORIES (e.g. Meat → Proteins; Veg/Fruit → Produce).
 */
export type CatalogChip = {
  id: string;
  label: string;
  /** Stored pantry category value */
  category: PantryCategory;
  /** Optional filter within Produce (Vegetables vs Fruit). */
  produceKind?: "veg" | "fruit";
};

export const CATALOG_CHIPS: CatalogChip[] = [
  { id: "meat", label: "Meat/Proteins", category: "Proteins" },
  { id: "veg", label: "Vegetables", category: "Produce", produceKind: "veg" },
  { id: "fruit", label: "Fruit", category: "Produce", produceKind: "fruit" },
  { id: "grains", label: "Grains & pasta", category: "Grains" },
  { id: "dairy", label: "Dairy", category: "Dairy" },
  { id: "canned", label: "Canned", category: "Canned" },
  { id: "spices", label: "Spices", category: "Spices" },
  { id: "oils", label: "Oils & condiments", category: "Oils & Condiments" },
  { id: "other", label: "Other", category: "Other" },
];

const produceVeg = new Set([
  "Yellow onion",
  "Onion",
  "Garlic",
  "Potato",
  "Potatoes",
  "Carrot",
  "Carrots",
  "Celery",
  "Bell pepper",
  "Tomato",
  "Broccoli",
  "Spinach",
  "Lettuce",
  "Cabbage",
  "Green cabbage",
  "Zucchini",
  "Cucumber",
  "Mushrooms",
]);

const produceFruit = new Set([
  "Apple",
  "Banana",
  "Orange",
  "Lemon",
  "Lime",
  "Grapes",
  "Berries",
  "Strawberries",
  "Avocado",
]);

/** Staple catalog — ~8–15 per major category. */
export const PANTRY_CATALOG: CatalogItem[] = [
  // Proteins
  { name: "Ground beef", defaultQty: 0.5, defaultUnit: "lb", category: "Proteins" },
  { name: "Chicken breast", defaultQty: 1, defaultUnit: "lb", category: "Proteins" },
  { name: "Chicken thighs", defaultQty: 1, defaultUnit: "lb", category: "Proteins" },
  { name: "Whole chicken", defaultQty: 1, defaultUnit: "each", category: "Proteins" },
  { name: "Eggs", defaultQty: 12, defaultUnit: "each", category: "Proteins" },
  { name: "Bacon", defaultQty: 12, defaultUnit: "oz", category: "Proteins" },
  { name: "Pork chops", defaultQty: 1, defaultUnit: "lb", category: "Proteins" },
  { name: "Ground turkey", defaultQty: 1, defaultUnit: "lb", category: "Proteins" },
  { name: "Canned tuna", defaultQty: 2, defaultUnit: "cans", category: "Proteins" },
  { name: "Peanut butter", defaultQty: 1, defaultUnit: "each", category: "Proteins" },
  { name: "Black beans (dry)", defaultQty: 1, defaultUnit: "lb", category: "Proteins" },
  { name: "Tofu", defaultQty: 14, defaultUnit: "oz", category: "Proteins" },

  // Produce — vegetables
  { name: "Yellow onion", defaultQty: 1, defaultUnit: "each", category: "Produce" },
  { name: "Garlic", defaultQty: 1, defaultUnit: "each", category: "Produce" },
  { name: "Potato", defaultQty: 3, defaultUnit: "each", category: "Produce" },
  { name: "Carrot", defaultQty: 4, defaultUnit: "each", category: "Produce" },
  { name: "Celery", defaultQty: 1, defaultUnit: "each", category: "Produce" },
  { name: "Bell pepper", defaultQty: 1, defaultUnit: "each", category: "Produce" },
  { name: "Tomato", defaultQty: 2, defaultUnit: "each", category: "Produce" },
  { name: "Broccoli", defaultQty: 1, defaultUnit: "each", category: "Produce" },
  { name: "Spinach", defaultQty: 1, defaultUnit: "pack", category: "Produce" },
  { name: "Lettuce", defaultQty: 1, defaultUnit: "each", category: "Produce" },
  { name: "Cabbage", defaultQty: 1, defaultUnit: "each", category: "Produce" },
  { name: "Zucchini", defaultQty: 2, defaultUnit: "each", category: "Produce" },
  { name: "Mushrooms", defaultQty: 8, defaultUnit: "oz", category: "Produce" },

  // Produce — fruit
  { name: "Apple", defaultQty: 3, defaultUnit: "each", category: "Produce" },
  { name: "Banana", defaultQty: 6, defaultUnit: "each", category: "Produce" },
  { name: "Orange", defaultQty: 4, defaultUnit: "each", category: "Produce" },
  { name: "Lemon", defaultQty: 2, defaultUnit: "each", category: "Produce" },
  { name: "Lime", defaultQty: 2, defaultUnit: "each", category: "Produce" },
  { name: "Grapes", defaultQty: 1, defaultUnit: "lb", category: "Produce" },
  { name: "Strawberries", defaultQty: 1, defaultUnit: "lb", category: "Produce" },
  { name: "Avocado", defaultQty: 2, defaultUnit: "each", category: "Produce" },

  // Grains
  { name: "Spaghetti", defaultQty: 8, defaultUnit: "oz", category: "Grains" },
  { name: "White rice", defaultQty: 2, defaultUnit: "cups", category: "Grains" },
  { name: "Brown rice", defaultQty: 2, defaultUnit: "cups", category: "Grains" },
  { name: "Flour", defaultQty: 2, defaultUnit: "cups", category: "Grains" },
  { name: "Bread", defaultQty: 1, defaultUnit: "each", category: "Grains" },
  { name: "Oats", defaultQty: 2, defaultUnit: "cups", category: "Grains" },
  { name: "Penne pasta", defaultQty: 12, defaultUnit: "oz", category: "Grains" },
  { name: "Flour tortillas", defaultQty: 10, defaultUnit: "each", category: "Grains" },
  { name: "Cornmeal", defaultQty: 1, defaultUnit: "cups", category: "Grains" },
  { name: "Breadcrumbs", defaultQty: 1, defaultUnit: "cups", category: "Grains" },

  // Dairy
  { name: "Milk", defaultQty: 1, defaultUnit: "each", category: "Dairy" },
  { name: "Butter", defaultQty: 1, defaultUnit: "each", category: "Dairy" },
  { name: "Cheddar cheese", defaultQty: 8, defaultUnit: "oz", category: "Dairy" },
  { name: "Mozzarella", defaultQty: 8, defaultUnit: "oz", category: "Dairy" },
  { name: "Yogurt", defaultQty: 1, defaultUnit: "each", category: "Dairy" },
  { name: "Cream cheese", defaultQty: 8, defaultUnit: "oz", category: "Dairy" },
  { name: "Sour cream", defaultQty: 8, defaultUnit: "oz", category: "Dairy" },
  { name: "Parmesan", defaultQty: 4, defaultUnit: "oz", category: "Dairy" },

  // Canned
  { name: "Canned diced tomatoes", defaultQty: 1, defaultUnit: "cans", category: "Canned" },
  { name: "Tomato sauce", defaultQty: 1, defaultUnit: "cans", category: "Canned" },
  { name: "Canned black beans", defaultQty: 1, defaultUnit: "cans", category: "Canned" },
  { name: "Canned chickpeas", defaultQty: 1, defaultUnit: "cans", category: "Canned" },
  { name: "Canned corn", defaultQty: 1, defaultUnit: "cans", category: "Canned" },
  { name: "Canned tuna", defaultQty: 2, defaultUnit: "cans", category: "Canned" },
  { name: "Chicken broth", defaultQty: 1, defaultUnit: "cans", category: "Canned" },
  { name: "Coconut milk", defaultQty: 1, defaultUnit: "cans", category: "Canned" },
  { name: "Canned green beans", defaultQty: 1, defaultUnit: "cans", category: "Canned" },

  // Spices
  { name: "Salt", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Black pepper", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Garlic powder", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Paprika", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Cumin", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Chili flakes", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Oregano", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Cinnamon", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Bay leaves", defaultQty: 1, defaultUnit: "each", category: "Spices" },
  { name: "Sugar", defaultQty: 2, defaultUnit: "cups", category: "Spices" },

  // Oils & Condiments
  { name: "Olive oil", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Vegetable oil", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Soy sauce", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "White vinegar", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Ketchup", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Mustard", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Mayonnaise", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Hot sauce", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Honey", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },
  { name: "Vanilla extract", defaultQty: 1, defaultUnit: "each", category: "Oils & Condiments" },

  // Other
  { name: "Baking powder", defaultQty: 1, defaultUnit: "each", category: "Other" },
  { name: "Baking soda", defaultQty: 1, defaultUnit: "each", category: "Other" },
  { name: "Chocolate chips", defaultQty: 12, defaultUnit: "oz", category: "Other" },
  { name: "Broth cubes", defaultQty: 1, defaultUnit: "pack", category: "Other" },
  { name: "Cornstarch", defaultQty: 1, defaultUnit: "each", category: "Other" },
  { name: "Yeast", defaultQty: 1, defaultUnit: "pack", category: "Other" },
];

export function itemsForChip(chip: CatalogChip): CatalogItem[] {
  const inCat = PANTRY_CATALOG.filter((i) => i.category === chip.category);
  if (chip.category !== "Produce" || !chip.produceKind) return inCat;
  if (chip.produceKind === "veg") {
    return inCat.filter((i) => produceVeg.has(i.name));
  }
  return inCat.filter((i) => produceFruit.has(i.name));
}

export function findCatalogItem(name: string): CatalogItem | undefined {
  const n = name.trim().toLowerCase();
  return PANTRY_CATALOG.find((i) => i.name.toLowerCase() === n);
}
