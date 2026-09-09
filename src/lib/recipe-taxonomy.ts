/**
 * Controlled recipe taxonomy: cuisine, course, food categories,
 * and ethnicity / national-origin foodways (hierarchical).
 * Used by UI chips, admin forms, API filters, and seed/backfill heuristics.
 */

export const CUISINES = [
  "American",
  "Mexican",
  "Italian",
  "Asian",
  "Indian",
  "Mediterranean",
  "French",
  "Middle Eastern",
  "Caribbean",
  "African",
  "Other",
] as const;

export type Cuisine = (typeof CUISINES)[number];

export const COURSES = [
  "breakfast",
  "lunch",
  "dinner",
  "main",
  "side",
  "starter",
  "dessert",
  "snack",
  "drink",
] as const;

export type Course = (typeof COURSES)[number];

export const FOOD_CATEGORIES = [
  "dairy",
  "meat",
  "seafood",
  "egg",
  "vegetable",
  "fruit",
  "grain",
  "legume",
  "dessert",
  "nut",
  "condiment",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/**
 * Culinary / cultural foodways labels (not religious gatekeeping).
 * Tree: selecting a parent matches that id OR any descendant.
 * Recipes may carry multiple overlapping origins.
 */
export type OriginNode = {
  id: string;
  label: string;
  children?: OriginNode[];
};

export const ORIGIN_TREE: OriginNode[] = [
  {
    id: "jewish",
    label: "Jewish",
    children: [
      { id: "ashkenazi-jewish", label: "Ashkenazi Jewish" },
      { id: "sephardi-jewish", label: "Sephardi Jewish" },
      { id: "mizrahi-jewish", label: "Mizrahi Jewish" },
      { id: "israeli-jewish", label: "Israeli Jewish" },
    ],
  },
  {
    id: "middle-eastern",
    label: "Middle Eastern",
    children: [
      { id: "arabic", label: "Arabic" },
      { id: "levantine", label: "Levantine" },
      { id: "israeli", label: "Israeli" },
      { id: "persian", label: "Persian" },
      { id: "turkish", label: "Turkish" },
    ],
  },
  {
    id: "muslim-friendly",
    label: "Muslim-friendly",
  },
  {
    id: "asian",
    label: "Asian",
    children: [
      { id: "chinese", label: "Chinese" },
      { id: "japanese", label: "Japanese" },
      { id: "korean", label: "Korean" },
      { id: "thai", label: "Thai" },
      { id: "vietnamese", label: "Vietnamese" },
      { id: "filipino", label: "Filipino" },
      { id: "indian", label: "Indian" },
    ],
  },
  {
    id: "european",
    label: "European",
    children: [
      { id: "italian", label: "Italian" },
      { id: "french", label: "French" },
      { id: "hungarian", label: "Hungarian" },
      { id: "greek", label: "Greek" },
      { id: "spanish", label: "Spanish" },
      { id: "british", label: "British" },
      { id: "german", label: "German" },
      { id: "eastern-european", label: "Eastern European" },
    ],
  },
  {
    id: "latin-american",
    label: "Latin American",
    children: [
      { id: "mexican", label: "Mexican" },
      { id: "caribbean", label: "Caribbean" },
      { id: "peruvian", label: "Peruvian" },
      { id: "brazilian", label: "Brazilian" },
    ],
  },
  {
    id: "american",
    label: "American",
    children: [
      { id: "southern-us", label: "Southern US" },
      { id: "tex-mex", label: "Tex-Mex" },
    ],
  },
  {
    id: "african",
    label: "African",
    children: [
      { id: "north-african", label: "North African" },
      { id: "west-african", label: "West African" },
    ],
  },
  {
    id: "mediterranean",
    label: "Mediterranean",
  },
];

/** Flat list for UI chips / selects (id + label + depth). */
export type OriginOption = { id: string; label: string; depth: number };

function walkOrigins(
  nodes: OriginNode[],
  depth: number,
  out: OriginOption[]
): void {
  for (const n of nodes) {
    out.push({ id: n.id, label: n.label, depth });
    if (n.children?.length) walkOrigins(n.children, depth + 1, out);
  }
}

export const ORIGIN_OPTIONS: OriginOption[] = (() => {
  const out: OriginOption[] = [];
  walkOrigins(ORIGIN_TREE, 0, out);
  return out;
})();

const ORIGIN_BY_ID = new Map(
  ORIGIN_OPTIONS.map((o) => [o.id, o] as const)
);

/** parent id → direct child ids */
const ORIGIN_CHILDREN = new Map<string, string[]>();
function indexChildren(nodes: OriginNode[]): void {
  for (const n of nodes) {
    if (n.children?.length) {
      ORIGIN_CHILDREN.set(
        n.id,
        n.children.map((c) => c.id)
      );
      indexChildren(n.children);
    }
  }
}
indexChildren(ORIGIN_TREE);

/** id → self + all descendant ids (for rollup filters). */
const ORIGIN_MATCH_SET = new Map<string, Set<string>>();
function buildMatchSet(id: string): Set<string> {
  const cached = ORIGIN_MATCH_SET.get(id);
  if (cached) return cached;
  const set = new Set<string>([id]);
  for (const child of ORIGIN_CHILDREN.get(id) || []) {
    for (const d of buildMatchSet(child)) set.add(d);
  }
  ORIGIN_MATCH_SET.set(id, set);
  return set;
}
for (const o of ORIGIN_OPTIONS) buildMatchSet(o.id);

export function originMatchIds(originId: string): Set<string> {
  const needle = originId.trim().toLowerCase();
  return ORIGIN_MATCH_SET.get(needle) ?? new Set([needle]);
}

export function isKnownOriginId(id: string): boolean {
  return ORIGIN_BY_ID.has(id.trim().toLowerCase());
}

export function normalizeOrigins(
  values: string[] | null | undefined
): string[] {
  if (!values?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const id = raw.trim().toLowerCase();
    if (!id || seen.has(id) || !ORIGIN_BY_ID.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * True if recipe origins intersect the selected origin's match set
 * (selected id OR any descendant).
 */
export function recipeMatchesOrigin(
  recipeOrigins: string[] | null | undefined,
  selectedOrigin: string | null | undefined
): boolean {
  const sel = (selectedOrigin ?? "").trim().toLowerCase();
  if (!sel) return true;
  const match = originMatchIds(sel);
  const have = (recipeOrigins || []).map((o) => o.trim().toLowerCase());
  return have.some((o) => match.has(o));
}

const CUISINE_SET = new Set(CUISINES.map((c) => c.toLowerCase()));
const COURSE_SET = new Set(COURSES.map((c) => c.toLowerCase()));
const FOOD_CAT_SET = new Set(FOOD_CATEGORIES.map((c) => c.toLowerCase()));

export function normalizeCuisine(
  value: string | null | undefined
): Cuisine | null {
  if (!value?.trim()) return null;
  const needle = value.trim().toLowerCase();
  const hit = CUISINES.find((c) => c.toLowerCase() === needle);
  return hit ?? null;
}

export function normalizeCourse(
  value: string | null | undefined
): Course | null {
  if (!value?.trim()) return null;
  const needle = value.trim().toLowerCase();
  const hit = COURSES.find((c) => c.toLowerCase() === needle);
  return hit ?? null;
}

export function normalizeFoodCategories(
  values: string[] | null | undefined
): FoodCategory[] {
  if (!values?.length) return [];
  const out: FoodCategory[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const needle = raw.trim().toLowerCase();
    if (!FOOD_CAT_SET.has(needle) || seen.has(needle)) continue;
    const hit = FOOD_CATEGORIES.find((c) => c === needle);
    if (hit) {
      seen.add(needle);
      out.push(hit);
    }
  }
  return out;
}

export function isCuisine(value: string): value is Cuisine {
  return CUISINE_SET.has(value.trim().toLowerCase());
}

export function isCourse(value: string): value is Course {
  return COURSE_SET.has(value.trim().toLowerCase());
}

export function isFoodCategory(value: string): value is FoodCategory {
  return FOOD_CAT_SET.has(value.trim().toLowerCase());
}

export type TaxonomyRecipeLike = {
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  cuisine?: string | null;
  course?: string | null;
  foodCategories?: string[] | null;
  origins?: string[] | null;
  ingredients?: { name: string }[] | null;
};

export type TaxonomyFilters = {
  q?: string | null;
  cuisine?: string | null;
  course?: string | null;
  foodCategory?: string | null;
  /** ethnicity / national origin id; matches self + descendants */
  origin?: string | null;
  ethnicity?: string | null;
};

/** Search across title, tags, cuisine, course, food categories, origins, ingredients. */
export function matchesRecipeSearch(
  recipe: TaxonomyRecipeLike,
  q: string | null | undefined
): boolean {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return true;
  const originLabels = (recipe.origins || []).map(
    (id) => ORIGIN_BY_ID.get(id)?.label || id
  );
  const parts: string[] = [
    recipe.title || "",
    recipe.description || "",
    recipe.cuisine || "",
    recipe.course || "",
    ...(recipe.tags || []),
    ...(recipe.foodCategories || []),
    ...(recipe.origins || []),
    ...originLabels,
    ...((recipe.ingredients || []).map((i) => i.name) || []),
  ];
  const text = parts.join(" ").toLowerCase();
  if (text.includes(needle)) return true;
  const tokens = needle.split(/\s+/).filter(Boolean);
  return tokens.every((t) => text.includes(t));
}

export function matchesTaxonomyFilters(
  recipe: TaxonomyRecipeLike,
  filters: TaxonomyFilters
): boolean {
  const cuisine = (filters.cuisine ?? "").trim();
  if (cuisine) {
    const want = cuisine.toLowerCase();
    if ((recipe.cuisine || "").trim().toLowerCase() !== want) return false;
  }
  const course = (filters.course ?? "").trim();
  if (course) {
    const want = course.toLowerCase();
    if ((recipe.course || "").trim().toLowerCase() !== want) return false;
  }
  const foodCategory = (filters.foodCategory ?? "").trim();
  if (foodCategory) {
    const want = foodCategory.toLowerCase();
    const cats = (recipe.foodCategories || []).map((c) => c.toLowerCase());
    if (!cats.includes(want)) return false;
  }
  const origin = (filters.origin ?? filters.ethnicity ?? "").trim();
  if (origin && !recipeMatchesOrigin(recipe.origins, origin)) return false;
  return matchesRecipeSearch(recipe, filters.q);
}

type InferInput = {
  title: string;
  tags?: string[];
  ingredients?: { name: string }[];
  description?: string | null;
};

function blob(input: InferInput): string {
  return [
    input.title,
    input.description || "",
    ...(input.tags || []),
    ...((input.ingredients || []).map((i) => i.name) || []),
  ]
    .join(" ")
    .toLowerCase();
}

function has(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

/**
 * Heuristic backfill from title/tags/ingredients.
 * Origins left empty when unclear — never invent wrong cultural labels.
 */
export function inferRecipeTaxonomy(input: InferInput): {
  cuisine: Cuisine;
  course: Course;
  foodCategories: FoodCategory[];
  origins: string[];
} {
  const text = blob(input);
  const tags = (input.tags || []).map((t) => t.toLowerCase());

  let cuisine: Cuisine = "American";
  const origins = new Set<string>();

  if (
    has(text, [
      "taco",
      "chili",
      "mexican",
      "salsa",
      "burrito",
      "enchilada",
      "quesadilla",
    ]) ||
    tags.some((t) => t === "tacos" || t === "chili")
  ) {
    cuisine = "Mexican";
    origins.add("mexican");
    origins.add("latin-american");
    if (has(text, ["chili", "taco"])) origins.add("tex-mex");
  } else if (
    has(text, ["pasta", "spaghetti", "parmesan", "italian", "pizza", "risotto"])
  ) {
    cuisine = "Italian";
    origins.add("italian");
    origins.add("european");
  } else if (
    has(text, [
      "stir-fry",
      "stir fry",
      "soy",
      "fried rice",
      "asian",
      "teriyaki",
      "ramen",
      "sesame",
    ]) ||
    tags.includes("stir-fry")
  ) {
    cuisine = "Asian";
    origins.add("asian");
    if (has(text, ["teriyaki", "ramen"])) origins.add("japanese");
    else if (has(text, ["fried rice", "stir-fry", "stir fry", "soy"])) {
      origins.add("chinese");
    }
  } else if (has(text, ["curry", "tikka", "masala", "indian", "naan"])) {
    cuisine = "Indian";
    origins.add("indian");
    origins.add("asian");
  } else if (
    has(text, ["hummus", "falafel", "shawarma", "tahini", "zaatar", "za'atar"])
  ) {
    cuisine = "Middle Eastern";
    origins.add("middle-eastern");
    origins.add("levantine");
    origins.add("arabic");
    // Shared Levantine foodways — overlapping origins intentional
    if (has(text, ["hummus", "falafel"])) {
      origins.add("israeli");
      origins.add("jewish");
      origins.add("muslim-friendly");
    }
  } else if (
    has(text, ["mediterranean", "tzatziki", "greek"])
  ) {
    cuisine = "Mediterranean";
    origins.add("mediterranean");
    if (has(text, ["greek", "tzatziki"])) {
      origins.add("greek");
      origins.add("european");
    }
  } else if (has(text, ["french", "croissant", "béchamel", "bechamel"])) {
    cuisine = "French";
    origins.add("french");
    origins.add("european");
  } else if (has(text, ["goulash", "paprikash", "hungarian"])) {
    cuisine = "Other";
    origins.add("hungarian");
    origins.add("european");
    origins.add("eastern-european");
  } else if (has(text, ["bagel", "latke", "kugel", "matzo", "challah", "brisket"])) {
    cuisine = "American";
    origins.add("jewish");
    origins.add("ashkenazi-jewish");
  } else if (
    has(text, ["apple pie", "grilled cheese", "pancake", "mashed potato", "roast chicken", "banana bread", "chocolate chip"])
  ) {
    cuisine = "American";
    origins.add("american");
  } else if (has(text, ["rice"]) && tags.includes("side")) {
    cuisine = "Asian";
    origins.add("asian");
  }

  let course: Course = "main";
  if (
    tags.includes("dessert") ||
    has(text, ["dessert", "cookie", "cookies", "pie", "cake", "brownie", "banana bread"])
  ) {
    course = "dessert";
  } else if (
    tags.includes("breakfast") ||
    tags.includes("brunch") ||
    has(text, ["pancake", "scrambled egg", "breakfast", "brunch"])
  ) {
    course = "breakfast";
  } else if (
    tags.includes("side") ||
    has(text, ["mashed potato", "side dish", "steamed rice", "boiled / steamed rice"])
  ) {
    course = "side";
  } else if (tags.includes("snack") || has(text, ["snack"])) {
    course = "snack";
  } else if (
    tags.includes("drink") ||
    has(text, ["smoothie", "cocktail", "beverage", "drink"])
  ) {
    course = "drink";
  } else if (
    tags.includes("starter") ||
    tags.includes("appetizer") ||
    has(text, ["appetizer", "starter", "hummus"])
  ) {
    course = "starter";
  } else if (tags.includes("lunch") && !tags.includes("dinner")) {
    course = "lunch";
  } else if (tags.includes("dinner")) {
    course = "dinner";
  } else if (has(text, ["soup"]) && !has(text, ["dessert"])) {
    course = has(text, ["chicken soup", "chili"]) ? "main" : "starter";
  } else if (has(text, ["sandwich", "grilled cheese", "melt"])) {
    course = "lunch";
  }

  const foodCategories = new Set<FoodCategory>();
  if (
    course === "dessert" ||
    has(text, ["dessert", "cookie", "pie", "cake", "banana bread"])
  ) {
    foodCategories.add("dessert");
  }
  if (
    has(text, [
      "chicken",
      "beef",
      "pork",
      "steak",
      "bacon",
      "meat",
      "sausage",
      "turkey",
      "lamb",
    ])
  ) {
    foodCategories.add("meat");
  }
  if (has(text, ["tuna", "salmon", "fish", "shrimp", "seafood", "cod"])) {
    foodCategories.add("seafood");
  }
  if (has(text, ["egg", "eggs"])) foodCategories.add("egg");
  if (
    has(text, [
      "cheese",
      "milk",
      "butter",
      "yogurt",
      "cream",
      "cheddar",
      "dairy",
    ])
  ) {
    foodCategories.add("dairy");
  }
  if (
    has(text, [
      "rice",
      "pasta",
      "spaghetti",
      "bread",
      "flour",
      "tortilla",
      "noodle",
      "oat",
      "grain",
    ])
  ) {
    foodCategories.add("grain");
  }
  if (has(text, ["bean", "beans", "lentil", "chickpea", "legume", "pea"])) {
    foodCategories.add("legume");
  }
  if (
    has(text, ["apple", "banana", "berry", "lemon", "fruit", "orange", "peach"])
  ) {
    foodCategories.add("fruit");
  }
  if (
    has(text, [
      "potato",
      "onion",
      "carrot",
      "cabbage",
      "broccoli",
      "pepper",
      "tomato",
      "vegetable",
      "celery",
      "garlic",
    ])
  ) {
    foodCategories.add("vegetable");
  }
  if (has(text, ["peanut", "almond", "walnut", "nut"])) {
    foodCategories.add("nut");
  }
  if (has(text, ["soy sauce", "vinegar", "chili flake", "condiment"])) {
    foodCategories.add("condiment");
  }

  if (foodCategories.size === 0) {
    foodCategories.add("vegetable");
  }

  return {
    cuisine,
    course,
    foodCategories: [...foodCategories],
    origins: [...origins],
  };
}
