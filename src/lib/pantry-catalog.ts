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

/**
 * Catalog staple — name + category for chips.
 * `suggestedUnit` is a soft default for the unit select AFTER selection;
 * quantity is never prefilled from the catalog.
 */
export type CatalogItem = {
  name: string;
  category: PantryCategory;
  /** Soft unit suggestion after selection — not shown on the chip. */
  suggestedUnit?: PantryUnit | string;
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
  { id: "baking", label: "Baking", category: "Baking" },
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

/** Sensible unit default by category when an item has no suggestedUnit. */
export function suggestedUnitForCategory(category: PantryCategory | string): string {
  switch (category) {
    case "Proteins":
      return "oz";
    case "Produce":
      return "each";
    case "Grains":
      return "oz";
    case "Baking":
      return "cups";
    case "Dairy":
      return "each";
    case "Canned":
      return "cans";
    case "Spices":
      return "each";
    case "Oils & Condiments":
      return "each";
    default:
      return "each";
  }
}

/** Fat % presets for meats (stored as tags like fat:80%). */
export const FAT_CONTENT_OPTIONS = [
  "",
  "70%",
  "80%",
  "85%",
  "90%",
  "93%",
  "other",
] as const;

export type FatContentOption = (typeof FAT_CONTENT_OPTIONS)[number];

export function fatTagFromSelection(value: string): string | null {
  const v = value.trim();
  if (!v || v === "other") return v === "other" ? "fat:other" : null;
  const pct = v.replace(/\s/g, "");
  if (!/^\d{2,3}%$/.test(pct)) return null;
  return `fat:${pct}`;
}

/** Staple catalog — name (+ category) only for display chips. */
export const PANTRY_CATALOG: CatalogItem[] = [
  // Proteins
  { name: "Ground beef", suggestedUnit: "lb", category: "Proteins" },
  { name: "Chicken breast", suggestedUnit: "lb", category: "Proteins" },
  { name: "Chicken thighs", suggestedUnit: "lb", category: "Proteins" },
  { name: "Whole chicken", suggestedUnit: "each", category: "Proteins" },
  { name: "Eggs", suggestedUnit: "each", category: "Proteins" },
  { name: "Bacon", suggestedUnit: "oz", category: "Proteins" },
  { name: "Pork chops", suggestedUnit: "lb", category: "Proteins" },
  { name: "Ground turkey", suggestedUnit: "lb", category: "Proteins" },
  { name: "Canned tuna", suggestedUnit: "cans", category: "Proteins" },
  { name: "Peanut butter", suggestedUnit: "each", category: "Proteins" },
  { name: "Black beans (dry)", suggestedUnit: "lb", category: "Proteins" },
  { name: "Tofu", suggestedUnit: "oz", category: "Proteins" },

  // Produce — vegetables
  { name: "Yellow onion", suggestedUnit: "each", category: "Produce" },
  { name: "Garlic", suggestedUnit: "each", category: "Produce" },
  { name: "Potato", suggestedUnit: "each", category: "Produce" },
  { name: "Carrot", suggestedUnit: "each", category: "Produce" },
  { name: "Celery", suggestedUnit: "each", category: "Produce" },
  { name: "Bell pepper", suggestedUnit: "each", category: "Produce" },
  { name: "Tomato", suggestedUnit: "each", category: "Produce" },
  { name: "Broccoli", suggestedUnit: "each", category: "Produce" },
  { name: "Spinach", suggestedUnit: "pack", category: "Produce" },
  { name: "Lettuce", suggestedUnit: "each", category: "Produce" },
  { name: "Cabbage", suggestedUnit: "each", category: "Produce" },
  { name: "Zucchini", suggestedUnit: "each", category: "Produce" },
  { name: "Mushrooms", suggestedUnit: "oz", category: "Produce" },

  // Produce — fruit
  { name: "Apple", suggestedUnit: "each", category: "Produce" },
  { name: "Banana", suggestedUnit: "each", category: "Produce" },
  { name: "Orange", suggestedUnit: "each", category: "Produce" },
  { name: "Lemon", suggestedUnit: "each", category: "Produce" },
  { name: "Lime", suggestedUnit: "each", category: "Produce" },
  { name: "Grapes", suggestedUnit: "lb", category: "Produce" },
  { name: "Strawberries", suggestedUnit: "lb", category: "Produce" },
  { name: "Avocado", suggestedUnit: "each", category: "Produce" },

  // Grains
  { name: "Spaghetti", suggestedUnit: "oz", category: "Grains" },
  { name: "White rice", suggestedUnit: "cups", category: "Grains" },
  { name: "Brown rice", suggestedUnit: "cups", category: "Grains" },
  { name: "Bread", suggestedUnit: "each", category: "Grains" },
  { name: "Oats", suggestedUnit: "cups", category: "Grains" },
  { name: "Penne pasta", suggestedUnit: "oz", category: "Grains" },
  { name: "Flour tortillas", suggestedUnit: "each", category: "Grains" },
  { name: "Cornmeal", suggestedUnit: "cups", category: "Grains" },
  { name: "Breadcrumbs", suggestedUnit: "cups", category: "Grains" },

  // Dairy
  { name: "Milk", suggestedUnit: "each", category: "Dairy" },
  { name: "Butter", suggestedUnit: "each", category: "Dairy" },
  { name: "Cheddar cheese", suggestedUnit: "oz", category: "Dairy" },
  { name: "Mozzarella", suggestedUnit: "oz", category: "Dairy" },
  { name: "Yogurt", suggestedUnit: "each", category: "Dairy" },
  { name: "Cream cheese", suggestedUnit: "oz", category: "Dairy" },
  { name: "Sour cream", suggestedUnit: "oz", category: "Dairy" },
  { name: "Parmesan", suggestedUnit: "oz", category: "Dairy" },

  // Canned
  { name: "Canned diced tomatoes", suggestedUnit: "cans", category: "Canned" },
  { name: "Tomato sauce", suggestedUnit: "cans", category: "Canned" },
  { name: "Canned black beans", suggestedUnit: "cans", category: "Canned" },
  { name: "Canned chickpeas", suggestedUnit: "cans", category: "Canned" },
  { name: "Canned corn", suggestedUnit: "cans", category: "Canned" },
  { name: "Canned tuna", suggestedUnit: "cans", category: "Canned" },
  { name: "Chicken broth", suggestedUnit: "cans", category: "Canned" },
  { name: "Coconut milk", suggestedUnit: "cans", category: "Canned" },
  { name: "Canned green beans", suggestedUnit: "cans", category: "Canned" },

  // Baking
  { name: "Flour", suggestedUnit: "cups", category: "Baking" },
  { name: "Sugar", suggestedUnit: "cups", category: "Baking" },
  { name: "Brown sugar", suggestedUnit: "cups", category: "Baking" },
  { name: "Powdered sugar", suggestedUnit: "cups", category: "Baking" },
  { name: "Baking powder", suggestedUnit: "each", category: "Baking" },
  { name: "Baking soda", suggestedUnit: "each", category: "Baking" },
  { name: "Chocolate chips", suggestedUnit: "oz", category: "Baking" },
  { name: "Cornstarch", suggestedUnit: "each", category: "Baking" },
  { name: "Yeast", suggestedUnit: "pack", category: "Baking" },
  { name: "Cocoa powder", suggestedUnit: "each", category: "Baking" },
  { name: "Vanilla extract", suggestedUnit: "each", category: "Baking" },

  // Spices
  { name: "Salt", suggestedUnit: "each", category: "Spices" },
  { name: "Black pepper", suggestedUnit: "each", category: "Spices" },
  { name: "Garlic powder", suggestedUnit: "each", category: "Spices" },
  { name: "Paprika", suggestedUnit: "each", category: "Spices" },
  { name: "Cumin", suggestedUnit: "each", category: "Spices" },
  { name: "Chili flakes", suggestedUnit: "each", category: "Spices" },
  { name: "Oregano", suggestedUnit: "each", category: "Spices" },
  { name: "Cinnamon", suggestedUnit: "each", category: "Spices" },
  { name: "Bay leaves", suggestedUnit: "each", category: "Spices" },

  // Oils & Condiments
  { name: "Olive oil", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "Vegetable oil", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "Soy sauce", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "White vinegar", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "Ketchup", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "Mustard", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "Mayonnaise", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "Hot sauce", suggestedUnit: "each", category: "Oils & Condiments" },
  { name: "Honey", suggestedUnit: "each", category: "Oils & Condiments" },

  // Other
  { name: "Broth cubes", suggestedUnit: "pack", category: "Other" },
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
