export type CostTier = "cheap" | "moderate";

export type PantryItemInput = {
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  tags?: string[];
  expirationDate?: string | null;
};

export type RecipeIngredientInput = {
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
};

export type RecipeInput = {
  title: string;
  description?: string | null;
  steps: string[];
  costTier?: CostTier;
  tags?: string[];
  servings?: number;
  sourceUrl?: string | null;
  isStruggleMeal?: boolean;
  techniqueTips?: string[];
  flavorBoosters?: string[];
  ingredients: RecipeIngredientInput[];
};

export type PantrySnapshot = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  tags: string[];
};

export type RecipeForMatch = {
  id: string;
  title: string;
  description: string | null;
  steps: string[];
  costTier: CostTier;
  tags: string[];
  servings: number;
  isStruggleMeal: boolean;
  techniqueTips: string[];
  flavorBoosters: string[];
  ingredients: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    optional: boolean;
  }[];
};

export type SuggestionResult = {
  recipe: RecipeForMatch;
  score: number;
  matchRatio: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  missingCount: number;
  canMakeNow: boolean;
  nearMiss: boolean;
  affordabilityBoost: number;
  struggleBoost: number;
  creativeNote?: string;
};
