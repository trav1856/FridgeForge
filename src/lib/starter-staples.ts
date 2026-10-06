/** Optional starter set a new member can add to their own household pantry. */
export type StarterStaple = {
  name: string;
  quantity: number;
  unit: string;
  category: string;
};

export const STARTER_STAPLES: StarterStaple[] = [
  { name: "White rice", quantity: 4, unit: "cups", category: "Grains" },
  { name: "Spaghetti", quantity: 1, unit: "box", category: "Grains" },
  { name: "Eggs", quantity: 12, unit: "each", category: "Proteins" },
  { name: "Canned tuna", quantity: 2, unit: "cans", category: "Canned" },
  { name: "Yellow onion", quantity: 3, unit: "each", category: "Produce" },
  { name: "Garlic", quantity: 1, unit: "head", category: "Produce" },
  { name: "Potatoes", quantity: 5, unit: "each", category: "Produce" },
  { name: "Vegetable oil", quantity: 1, unit: "bottle", category: "Oils & Condiments" },
  { name: "Soy sauce", quantity: 1, unit: "bottle", category: "Oils & Condiments" },
  { name: "Salt", quantity: 1, unit: "box", category: "Spices" },
  { name: "Black pepper", quantity: 1, unit: "jar", category: "Spices" },
  { name: "Chili flakes", quantity: 1, unit: "jar", category: "Spices" },
];
