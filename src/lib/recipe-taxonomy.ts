/**
 * Controlled recipe taxonomy: cuisine, course, food categories,
 * and ethnicity / national-origin foodways (hierarchical).
 * Used by UI chips, admin forms, API filters, and seed/backfill heuristics.
 */

export const CUISINES = [
  "American",
  "Mexican",
  "Italian",
  "Chinese",
  "Japanese",
  "Korean",
  "Filipino",
  "Thai",
  "Vietnamese",
  "Cambodian",
  "Asian",
  "Indian",
  "Mediterranean",
  "French",
  "Eastern European",
  "Russian",
  "Ukrainian",
  "Polish",
  "Belarusian",
  "Middle Eastern",
  "Caribbean",
  "African",
  "Native American",
  "Slow cooker",
  "Other",
] as const;

/**
 * Cuisines that roll up under the Asian parent bucket for ?cuisine=Asian
 * filters and auto-add the asian origin association. Russian is excluded.
 */
export const ASIAN_CHILD_CUISINES = [
  "Chinese",
  "Japanese",
  "Korean",
  "Filipino",
  "Thai",
  "Vietnamese",
  "Cambodian",
  "Indian",
] as const;

/**
 * Eastern European specifics that roll up under the Eastern European parent
 * bucket for ?cuisine=Eastern European filters.
 */
export const EASTERN_EUROPEAN_CHILD_CUISINES = [
  "Russian",
  "Ukrainian",
  "Polish",
  "Belarusian",
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

/** Land-meat subtype. Fish/shrimp stay under seafood, not meat. */
export const MEAT_TYPES = ["beef", "pork", "chicken", "other"] as const;
export type MeatType = (typeof MEAT_TYPES)[number];

/**
 * Culinary / cultural foodways labels (not religious gatekeeping).
 * Organized by continent/region for UI; nested children still roll up in filters.
 * Recipes may carry multiple overlapping origins.
 */
export type OriginNode = {
  id: string;
  label: string;
  children?: OriginNode[];
};

/** Top-level UI regions — display order fixed; entries A–Z within each. */
export type OriginRegion = {
  id: string;
  label: string;
  entries: OriginNode[];
};

function sortByLabel(nodes: OriginNode[]): OriginNode[] {
  return [...nodes]
    .map((n) =>
      n.children?.length
        ? { ...n, children: sortByLabel(n.children) }
        : { ...n }
    )
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

/**
 * Region → foodways. Nested diaspora labels (e.g. Ashkenazi under Jewish)
 * stay under their parent; parents are A–Z inside the region.
 */
export const ORIGIN_REGIONS: OriginRegion[] = [
  {
    id: "africa",
    label: "Africa",
    entries: sortByLabel([
      {
        id: "african",
        label: "African",
        children: [
          { id: "north-african", label: "North African" },
          { id: "west-african", label: "West African" },
        ],
      },
      { id: "ethiopian", label: "Ethiopian" },
      { id: "moroccan", label: "Moroccan" },
    ]),
  },
  {
    id: "asia",
    label: "Asia",
    entries: sortByLabel([
      {
        id: "asian",
        label: "Asian",
        children: [
          { id: "chinese", label: "Chinese" },
          { id: "filipino", label: "Filipino" },
          { id: "indian", label: "Indian" },
          { id: "japanese", label: "Japanese" },
          { id: "korean", label: "Korean" },
          { id: "thai", label: "Thai" },
          { id: "vietnamese", label: "Vietnamese" },
        ],
      },
    ]),
  },
  {
    id: "europe",
    label: "Europe",
    entries: sortByLabel([
      { id: "british", label: "British" },
      { id: "eastern-european", label: "Eastern European" },
      {
        id: "european",
        label: "European",
        children: [
          { id: "french", label: "French" },
          { id: "german", label: "German" },
          { id: "greek", label: "Greek" },
          { id: "hungarian", label: "Hungarian" },
          { id: "italian", label: "Italian" },
          { id: "spanish", label: "Spanish" },
        ],
      },
      { id: "mediterranean", label: "Mediterranean" },
    ]),
  },
  {
    id: "middle-east-levant",
    label: "Middle East / Levant",
    entries: sortByLabel([
      { id: "arabic", label: "Arabic" },
      { id: "israeli", label: "Israeli" },
      {
        id: "jewish",
        label: "Jewish",
        children: [
          { id: "ashkenazi-jewish", label: "Ashkenazi Jewish" },
          { id: "israeli-jewish", label: "Israeli Jewish" },
          { id: "mizrahi-jewish", label: "Mizrahi Jewish" },
          { id: "sephardi-jewish", label: "Sephardi Jewish" },
        ],
      },
      { id: "levantine", label: "Levantine" },
      {
        id: "middle-eastern",
        label: "Middle Eastern",
        children: [
          { id: "persian", label: "Persian" },
          { id: "turkish", label: "Turkish" },
        ],
      },
      { id: "muslim-friendly", label: "Muslim-friendly" },
    ]),
  },
  {
    id: "north-america",
    label: "North America",
    entries: sortByLabel([
      {
        id: "american",
        label: "American",
        children: [
          { id: "southern-us", label: "Southern US" },
          { id: "tex-mex", label: "Tex-Mex" },
        ],
      },
      { id: "canadian", label: "Canadian" },
      { id: "caribbean", label: "Caribbean" },
      { id: "mexican", label: "Mexican" },
    ]),
  },
  {
    id: "south-america-latin",
    label: "South America / Latin America",
    entries: sortByLabel([
      { id: "argentine", label: "Argentine" },
      { id: "brazilian", label: "Brazilian" },
      {
        id: "latin-american",
        label: "Latin American",
        children: [{ id: "peruvian", label: "Peruvian" }],
      },
    ]),
  },
  {
    id: "pacific-oceania",
    label: "Pacific Rim / Oceania / Polynesia",
    entries: sortByLabel([
      { id: "australian", label: "Australian" },
      { id: "hawaiian", label: "Hawaiian" },
      { id: "indonesian", label: "Indonesian" },
      { id: "malaysian", label: "Malaysian" },
      { id: "polynesian", label: "Polynesian" },
      {
        id: "pacific-rim",
        label: "Pacific Rim",
        children: [
          { id: "new-zealand", label: "New Zealand" },
          { id: "singaporean", label: "Singaporean" },
        ],
      },
    ]),
  },
];

/** Flat hierarchy for filter rollup (region roots omitted; entries + descendants). */
export const ORIGIN_TREE: OriginNode[] = ORIGIN_REGIONS.flatMap((r) => r.entries);

/** Flat list for searches (id + label + depth + region). */
export type OriginOption = {
  id: string;
  label: string;
  depth: number;
  regionId: string;
  regionLabel: string;
};

function walkOrigins(
  nodes: OriginNode[],
  depth: number,
  regionId: string,
  regionLabel: string,
  out: OriginOption[]
): void {
  for (const n of nodes) {
    out.push({
      id: n.id,
      label: n.label,
      depth,
      regionId,
      regionLabel,
    });
    if (n.children?.length) {
      walkOrigins(n.children, depth + 1, regionId, regionLabel, out);
    }
  }
}

export const ORIGIN_OPTIONS: OriginOption[] = (() => {
  const out: OriginOption[] = [];
  for (const region of ORIGIN_REGIONS) {
    walkOrigins(region.entries, 0, region.id, region.label, out);
  }
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
  let needle = value.trim().toLowerCase();
  // Aliases
  if (needle === "philippine" || needle === "philippines") needle = "filipino";
  if (needle === "native american" || needle === "indigenous american") {
    needle = "native american";
  }
  const hit = CUISINES.find((c) => c.toLowerCase() === needle);
  return hit ?? null;
}

/** Cuisines matched by a cuisine filter (Asian includes East/SE children + Indian; not Russian). */
export function cuisineFilterMatchSet(filterCuisine: string): Set<string> {
  const want = filterCuisine.trim().toLowerCase();
  if (!want) return new Set();
  if (want === "asian") {
    return new Set(
      ["asian", ...ASIAN_CHILD_CUISINES.map((c) => c.toLowerCase())]
    );
  }
  if (want === "eastern european") {
    return new Set([
      "eastern european",
      ...EASTERN_EUROPEAN_CHILD_CUISINES.map((c) => c.toLowerCase()),
    ]);
  }
  return new Set([want]);
}

export function recipeMatchesCuisineFilter(
  recipeCuisine: string | null | undefined,
  filterCuisine: string | null | undefined
): boolean {
  const filt = (filterCuisine ?? "").trim();
  if (!filt) return true;
  const have = (recipeCuisine || "").trim().toLowerCase();
  if (!have) return false;
  return cuisineFilterMatchSet(filt).has(have);
}

/** Ensure East/SE Asian specifics carry the asian origin parent (not Indian). */
/** Ensure Asian-linked specifics carry the asian origin parent. */
export function ensureAsianParentOrigins(
  cuisine: string | null | undefined,
  origins: string[]
): string[] {
  const c = normalizeCuisine(cuisine);
  if (!c) return origins;
  const isChild = (ASIAN_CHILD_CUISINES as readonly string[]).includes(c);
  if (!isChild) return origins;
  if (origins.map((o) => o.toLowerCase()).includes("asian")) return origins;
  return normalizeOrigins([...origins, "asian"]);
}

/** Ensure EE specifics carry eastern-european origin parent. */
export function ensureEasternEuropeanParentOrigins(
  cuisine: string | null | undefined,
  origins: string[]
): string[] {
  const c = normalizeCuisine(cuisine);
  if (!c) return origins;
  const isChild = (EASTERN_EUROPEAN_CHILD_CUISINES as readonly string[]).includes(
    c
  );
  if (!isChild) return origins;
  if (origins.map((o) => o.toLowerCase()).includes("eastern-european")) {
    return origins;
  }
  return normalizeOrigins([...origins, "eastern-european"]);
}

/** Apply all parent-bucket origin associations for a cuisine selection. */
export function ensureParentCuisineOrigins(
  cuisine: string | null | undefined,
  origins: string[]
): string[] {
  return ensureEasternEuropeanParentOrigins(
    cuisine,
    ensureAsianParentOrigins(cuisine, origins)
  );
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

export function normalizeMeatType(
  value: string | null | undefined
): MeatType | null {
  if (!value?.trim()) return null;
  const needle = value.trim().toLowerCase();
  const hit = MEAT_TYPES.find((m) => m === needle);
  return hit ?? null;
}

export function isMeatType(value: string | null | undefined): value is MeatType {
  return normalizeMeatType(value) != null;
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
  meatType?: string | null;
  ingredients?: { name: string }[] | null;
};

export type TaxonomyFilters = {
  q?: string | null;
  cuisine?: string | null;
  course?: string | null;
  foodCategory?: string | null;
  /** Land-meat subtype when foodCategory=meat (beef|pork|chicken|other) */
  meatType?: string | null;
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
  if (cuisine && !recipeMatchesCuisineFilter(recipe.cuisine, cuisine)) {
    return false;
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
  const meatType = (filters.meatType ?? "").trim();
  if (meatType) {
    const want = meatType.toLowerCase();
    if ((recipe.meatType || "").trim().toLowerCase() !== want) return false;
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
  steps?: string[] | null;
};

function blob(input: InferInput): string {
  return [
    input.title,
    input.description || "",
    ...(input.tags || []),
    ...((input.ingredients || []).map((i) => i.name) || []),
    ...(input.steps || []),
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
  meatType: MeatType | null;
} {
  const text = blob(input);
  const tags = (input.tags || []).map((t) => t.toLowerCase());

  let cuisine: Cuisine = "American";
  const origins = new Set<string>();

  // Slow cooker / crock pot — method-as-cuisine label (checked first).
  const slowCookerCue =
    tags.some((t) =>
      ["slow cooker", "slow-cooker", "crockpot", "crock pot", "crock-pot"].includes(t)
    ) ||
    /\b(slow\s*cooker|crock\s*pot|crockpot)\b/.test(text);

  if (slowCookerCue) {
    cuisine = "Slow cooker";
  } else {
  // Mexican only from strong dish/tag cues — not "chili" as a seasoning word.
  const mexicanCue =
    tags.some((t) =>
      ["tacos", "taco", "chili", "mexican", "tex-mex", "empanada", "empanadas"].includes(t)
    ) ||
    /\b(taco|tacos|burrito|enchilada|quesadilla|mexican|tex-mex|empanada|empanadas)\b/.test(
      text
    ) ||
    /\bchili\s*\/\s*taco\b/.test(text) ||
    /^chili\b/i.test(input.title.trim());

  if (mexicanCue) {
    cuisine = "Mexican";
    origins.add("mexican");
    origins.add("latin-american");
    if (/\b(taco|chili|tex-mex)\b/.test(text) || tags.includes("tacos")) {
      origins.add("tex-mex");
    }
  } else if (
    has(text, ["pasta", "spaghetti", "parmesan", "italian", "pizza", "risotto"])
  ) {
    cuisine = "Italian";
    origins.add("italian");
    origins.add("european");
  } else if (
    has(text, ["sushi", "teriyaki", "ramen", "miso", "udon", "tempura", "japanese"]) ||
    tags.includes("japanese")
  ) {
    cuisine = "Japanese";
    origins.add("japanese");
    origins.add("asian");
  } else if (
    has(text, ["kimchi", "gochujang", "bulgogi", "bibimbap", "korean"]) ||
    tags.includes("korean")
  ) {
    cuisine = "Korean";
    origins.add("korean");
    origins.add("asian");
  } else if (
    has(text, ["pad thai", "green curry", "thai basil", "thai"]) ||
    tags.includes("thai")
  ) {
    cuisine = "Thai";
    origins.add("thai");
    origins.add("asian");
  } else if (
    has(text, ["pho", "banh mi", "vietnamese", "nuoc cham"]) ||
    tags.includes("vietnamese")
  ) {
    cuisine = "Vietnamese";
    origins.add("vietnamese");
    origins.add("asian");
  } else if (
    has(text, [
      "adobo",
      "lumpia",
      "pancit",
      "sinigang",
      "filipino",
      "philippine",
      "philippines",
    ]) ||
    tags.includes("filipino") ||
    tags.includes("philippine")
  ) {
    cuisine = "Filipino";
    origins.add("filipino");
    origins.add("asian");
  } else if (
    has(text, ["amok", "lok lak", "loc lac", "cambodian", "khmer"]) ||
    tags.includes("cambodian") ||
    tags.includes("khmer")
  ) {
    cuisine = "Cambodian";
    origins.add("asian");
  } else if (
    has(text, [
      "stir-fry",
      "stir fry",
      "fried rice",
      "chow mein",
      "kung pao",
      "szechuan",
      "sichuan",
      "dim sum",
      "chinese",
    ]) ||
    tags.includes("stir-fry") ||
    tags.includes("chinese")
  ) {
    cuisine = "Chinese";
    origins.add("chinese");
    origins.add("asian");
  } else if (
    has(text, ["asian", "sesame", "soy", "soy sauce"]) ||
    tags.includes("asian")
  ) {
    cuisine = "Asian";
    origins.add("asian");
  } else if (has(text, ["curry", "tikka", "masala", "indian", "naan", "butter chicken", "biryani", "vindaloo"])) {
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
  } else if (
    has(text, [
      "jerk",
      "caribbean",
      "haitian",
      "jamaican",
      "cuban",
      "plantain",
      "sofrito",
    ]) ||
    tags.includes("caribbean") ||
    tags.includes("jerk")
  ) {
    cuisine = "Caribbean";
    origins.add("caribbean");
  } else if (
    has(text, [
      "native american",
      "indigenous",
      "three sisters",
      "frybread",
      "fry bread",
      "navajo",
    ]) ||
    tags.includes("native american")
  ) {
    cuisine = "Native American";
    // No forced wrong origin — leave origins sparse unless tagged elsewhere
  } else if (has(text, ["french", "croissant", "béchamel", "bechamel"])) {
    cuisine = "French";
    origins.add("french");
    origins.add("european");
  } else if (
    has(text, ["varenyky", "vareniki", "ukrainian", "holubtsi"]) ||
    tags.includes("ukrainian")
  ) {
    cuisine = "Ukrainian";
    origins.add("eastern-european");
  } else if (
    has(text, ["pierogi", "kielbasa", "bigos", "polish", "golabki", "gołąbki"]) ||
    tags.includes("polish")
  ) {
    cuisine = "Polish";
    origins.add("eastern-european");
  } else if (
    has(text, ["belarusian", "draniki", "machanka"]) ||
    tags.includes("belarusian")
  ) {
    cuisine = "Belarusian";
    origins.add("eastern-european");
  } else if (
    has(text, [
      "borscht",
      "borshch",
      "stroganoff",
      "beef stroganoff",
      "russian",
      "pelmeni",
      "blini",
    ]) ||
    tags.includes("russian")
  ) {
    // Russian is Eastern European (not Asian).
    cuisine = "Russian";
    origins.add("eastern-european");
  } else if (
    has(text, ["eastern european", "eastern-european"]) ||
    tags.includes("eastern european")
  ) {
    cuisine = "Eastern European";
    origins.add("eastern-european");
  } else if (has(text, ["goulash", "paprikash", "hungarian"])) {
    cuisine = "Other";
    origins.add("hungarian");
    origins.add("european");
    origins.add("eastern-european");
  } else if (
    has(text, [
      "bagel",
      "latke",
      "kugel",
      "matzo",
      "challah",
      "brisket",
      "hamantaschen",
      "hamantasch",
      "jewish apple cake",
    ])
  ) {
    // Ashkenazi sweets/staples: American cuisine label + Jewish origins (not Middle Eastern).
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
  // Land meat vs seafood: fish/shrimp stay seafood only (never meatType).
  const seafoodCue = has(text, [
    "tuna",
    "salmon",
    "fish",
    "shrimp",
    "seafood",
    "cod",
    "tilapia",
    "halibut",
    "prawn",
  ]);
  let meatType: MeatType | null = null;
  if (
    /\b(ground\s+beef|beef|steak|brisket|short\s*rib|ribeye|sirloin)\b/.test(text)
  ) {
    meatType = "beef";
  } else if (/\b(pork|bacon|ham|prosciutto|pancetta|pulled\s+pork)\b/.test(text)) {
    meatType = "pork";
  } else if (/\b(chicken|hen)\b/.test(text)) {
    meatType = "chicken";
  } else if (
    /\b(lamb|goat|venison|turkey|duck|bison|veal|rabbit|meat|sausage)\b/.test(text)
  ) {
    // turkey/duck/etc. → other (not chicken); generic "meat"/"sausage" → other
    meatType = "other";
  }
  if (meatType) {
    foodCategories.add("meat");
  }
  if (seafoodCue) {
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
    meatType,
  };
}

/**
 * When cuisine is blank on create/update, fill cuisine/course/origins/foodCategories/meatType
 * from inferRecipeTaxonomy. Non-destructive for fields the caller already set.
 */
export function resolveTaxonomyForWrite(input: {
  title: string;
  description?: string | null;
  tags?: string[];
  ingredients?: { name: string }[];
  steps?: string[] | null;
  cuisine?: string | null;
  course?: string | null;
  foodCategories?: string[] | null;
  origins?: string[] | null;
  meatType?: string | null;
}): {
  cuisine: Cuisine | null;
  course: Course | null;
  foodCategories: FoodCategory[];
  origins: string[];
  meatType: MeatType | null;
} {
  let cuisine = normalizeCuisine(input.cuisine ?? null);
  let course = normalizeCourse(input.course ?? null);
  let foodCategories = normalizeFoodCategories(input.foodCategories);
  let origins = normalizeOrigins(input.origins);
  let meatType = normalizeMeatType(input.meatType ?? null);

  const cuisineBlank = !cuisine;
  const needsMeatType =
    !meatType &&
    (foodCategories.includes("meat") ||
      cuisineBlank ||
      !foodCategories.length);

  if (cuisineBlank || needsMeatType || !course || !foodCategories.length || !origins.length) {
    const inferred = inferRecipeTaxonomy({
      title: input.title,
      description: input.description,
      tags: input.tags,
      ingredients: input.ingredients,
      steps: input.steps,
    });
    if (cuisineBlank) cuisine = inferred.cuisine;
    if (!course) course = inferred.course;
    if (!foodCategories.length) foodCategories = inferred.foodCategories;
    if (!origins.length && cuisineBlank) origins = inferred.origins;
    if (!meatType && inferred.meatType) {
      meatType = inferred.meatType;
      if (!foodCategories.includes("meat")) {
        foodCategories = [...foodCategories, "meat"];
      }
    }
  }

  if (!foodCategories.includes("meat")) {
    meatType = null;
  }

  origins = ensureParentCuisineOrigins(cuisine, origins);

  return { cuisine, course, foodCategories, origins, meatType };
}
