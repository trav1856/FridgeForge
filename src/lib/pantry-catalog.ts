import type { PantryCategory } from "./categories";
import type { MeasureKind } from "./units";

/** Broad unit list (fallback / edit forms). Prefer `unitsForItem` for intake. */
export const PANTRY_UNITS = [
  "each",
  "dozen",
  "oz",
  "lb",
  "g",
  "kg",
  "fl oz",
  "cups",
  "tbsp",
  "tsp",
  "pints",
  "quarts",
  "gallons",
  "ml",
  "L",
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
  /** Substance measure kind for unit picker; inferred from name/category if omitted. */
  measureKind?: MeasureKind;
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
      return "oz";
    case "Canned":
      return "cans";
    case "Spices":
      return "tsp";
    case "Oils & Condiments":
      return "fl oz";
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
  { name: "Ground beef", suggestedUnit: "lb", category: "Proteins", measureKind: "solid_weight" },
  { name: "Chicken breast", suggestedUnit: "lb", category: "Proteins", measureKind: "solid_weight" },
  { name: "Chicken thighs", suggestedUnit: "lb", category: "Proteins", measureKind: "solid_weight" },
  { name: "Whole chicken", suggestedUnit: "each", category: "Proteins", measureKind: "count" },
  { name: "Eggs", suggestedUnit: "each", category: "Proteins", measureKind: "count" },
  { name: "Bacon", suggestedUnit: "oz", category: "Proteins", measureKind: "solid_weight" },
  { name: "Pork chops", suggestedUnit: "lb", category: "Proteins", measureKind: "solid_weight" },
  { name: "Ground turkey", suggestedUnit: "lb", category: "Proteins", measureKind: "solid_weight" },
  { name: "Canned tuna", suggestedUnit: "cans", category: "Proteins", measureKind: "canned" },
  { name: "Peanut butter", suggestedUnit: "oz", category: "Proteins", measureKind: "semi_solid" },
  { name: "Black beans (dry)", suggestedUnit: "lb", category: "Proteins", measureKind: "solid_weight" },
  { name: "Tofu", suggestedUnit: "oz", category: "Proteins", measureKind: "solid_weight" },

  // Produce — vegetables
  { name: "Yellow onion", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Garlic", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Potato", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Carrot", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Celery", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Bell pepper", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Tomato", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Broccoli", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Spinach", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Lettuce", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Cabbage", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Zucchini", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Mushrooms", suggestedUnit: "oz", category: "Produce", measureKind: "produce" },

  // Produce — fruit
  { name: "Apple", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Banana", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Orange", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Lemon", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Lime", suggestedUnit: "each", category: "Produce", measureKind: "produce" },
  { name: "Grapes", suggestedUnit: "lb", category: "Produce", measureKind: "produce" },
  { name: "Strawberries", suggestedUnit: "lb", category: "Produce", measureKind: "produce" },
  { name: "Avocado", suggestedUnit: "each", category: "Produce", measureKind: "produce" },

  // Grains
  { name: "Spaghetti", suggestedUnit: "oz", category: "Grains", measureKind: "solid_weight" },
  { name: "White rice", suggestedUnit: "cups", category: "Grains", measureKind: "volume_dry" },
  { name: "Brown rice", suggestedUnit: "cups", category: "Grains", measureKind: "volume_dry" },
  { name: "Bread", suggestedUnit: "each", category: "Grains", measureKind: "count" },
  { name: "Oats", suggestedUnit: "cups", category: "Grains", measureKind: "volume_dry" },
  { name: "Penne pasta", suggestedUnit: "oz", category: "Grains", measureKind: "solid_weight" },
  { name: "Flour tortillas", suggestedUnit: "each", category: "Grains", measureKind: "count" },
  { name: "Cornmeal", suggestedUnit: "cups", category: "Grains", measureKind: "volume_dry" },
  { name: "Breadcrumbs", suggestedUnit: "cups", category: "Grains", measureKind: "volume_dry" },

  // Dairy
  { name: "Milk", suggestedUnit: "fl oz", category: "Dairy", measureKind: "liquid" },
  { name: "Butter", suggestedUnit: "oz", category: "Dairy", measureKind: "semi_solid" },
  { name: "Cheddar cheese", suggestedUnit: "oz", category: "Dairy", measureKind: "semi_solid" },
  { name: "Mozzarella", suggestedUnit: "oz", category: "Dairy", measureKind: "semi_solid" },
  { name: "Yogurt", suggestedUnit: "oz", category: "Dairy", measureKind: "semi_solid" },
  { name: "Cream cheese", suggestedUnit: "oz", category: "Dairy", measureKind: "semi_solid" },
  { name: "Sour cream", suggestedUnit: "oz", category: "Dairy", measureKind: "semi_solid" },
  { name: "Parmesan", suggestedUnit: "oz", category: "Dairy", measureKind: "semi_solid" },

  // Canned
  { name: "Canned diced tomatoes", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },
  { name: "Tomato sauce", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },
  { name: "Canned black beans", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },
  { name: "Canned chickpeas", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },
  { name: "Canned corn", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },
  { name: "Canned tuna", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },
  { name: "Chicken broth", suggestedUnit: "cans", category: "Canned", measureKind: "liquid" },
  { name: "Coconut milk", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },
  { name: "Canned green beans", suggestedUnit: "cans", category: "Canned", measureKind: "canned" },

  // Baking
  { name: "Flour", suggestedUnit: "cups", category: "Baking", measureKind: "volume_dry" },
  { name: "Sugar", suggestedUnit: "cups", category: "Baking", measureKind: "volume_dry" },
  { name: "Brown sugar", suggestedUnit: "cups", category: "Baking", measureKind: "volume_dry" },
  { name: "Powdered sugar", suggestedUnit: "cups", category: "Baking", measureKind: "volume_dry" },
  { name: "Baking powder", suggestedUnit: "tsp", category: "Baking", measureKind: "spice" },
  { name: "Baking soda", suggestedUnit: "tsp", category: "Baking", measureKind: "spice" },
  { name: "Chocolate chips", suggestedUnit: "oz", category: "Baking", measureKind: "solid_weight" },
  { name: "Cornstarch", suggestedUnit: "tbsp", category: "Baking", measureKind: "spice" },
  { name: "Yeast", suggestedUnit: "pack", category: "Baking", measureKind: "count" },
  { name: "Cocoa powder", suggestedUnit: "cups", category: "Baking", measureKind: "volume_dry" },
  { name: "Vanilla extract", suggestedUnit: "tsp", category: "Baking", measureKind: "spice" },

  // Spices
  { name: "Salt", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Black pepper", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Garlic powder", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Paprika", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Cumin", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Chili flakes", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Oregano", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Cinnamon", suggestedUnit: "tsp", category: "Spices", measureKind: "spice" },
  { name: "Bay leaves", suggestedUnit: "each", category: "Spices", measureKind: "count" },

  // Oils & Condiments
  { name: "Olive oil", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "Vegetable oil", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "Soy sauce", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "White vinegar", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "Ketchup", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "Mustard", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "Mayonnaise", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "Hot sauce", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },
  { name: "Honey", suggestedUnit: "fl oz", category: "Oils & Condiments", measureKind: "oil" },

  // Other
  { name: "Broth cubes", suggestedUnit: "pack", category: "Other", measureKind: "count" },
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
