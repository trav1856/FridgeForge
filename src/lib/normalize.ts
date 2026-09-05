/** Normalize ingredient/pantry names for fuzzy matching. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(fresh|dried|frozen|canned|organic|large|small|medium)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cheap staple aliases so "eggs" matches "large eggs", "rice" matches "white rice", etc. */
const ALIASES: Record<string, string[]> = {
  rice: ["white rice", "brown rice", "jasmine rice", "long grain rice", "rice"],
  beans: ["black beans", "pinto beans", "kidney beans", "canned beans", "dry beans"],
  eggs: ["egg", "large eggs", "chicken eggs"],
  pasta: ["spaghetti", "noodles", "macaroni", "penne", "elbow pasta"],
  onion: ["onions", "yellow onion", "white onion", "red onion"],
  garlic: ["garlic cloves", "garlic clove", "minced garlic"],
  tomato: ["tomatoes", "canned tomatoes", "diced tomatoes", "tomato sauce"],
  potato: ["potatoes", "russet potato", "yukon potato"],
  chicken: ["chicken breast", "chicken thighs", "chicken meat"],
  oil: ["cooking oil", "vegetable oil", "olive oil", "canola oil"],
  butter: ["salted butter", "unsalted butter"],
  milk: ["whole milk", "2% milk", "skim milk"],
  flour: ["all purpose flour", "ap flour", "wheat flour"],
  sugar: ["white sugar", "granulated sugar"],
  soy: ["soy sauce", "tamari"],
  vinegar: ["white vinegar", "apple cider vinegar", "rice vinegar"],
  lemon: ["lemons", "lemon juice", "citrus"],
  lime: ["limes", "lime juice"],
  cheese: ["cheddar", "shredded cheese", "parmesan"],
  bread: ["sandwich bread", "loaf", "toast"],
  tortilla: ["tortillas", "flour tortilla", "corn tortilla"],
  tuna: ["canned tuna", "tuna fish"],
  peanut: ["peanut butter", "pb"],
  cabbage: ["green cabbage", "shredded cabbage"],
  carrot: ["carrots"],
  celery: ["celery stalks"],
  chili: ["chili flakes", "red pepper flakes", "crushed red pepper"],
  salt: ["kosher salt", "sea salt", "table salt"],
  pepper: ["black pepper", "ground pepper"],
};

export function expandAliases(name: string): string[] {
  const n = normalizeName(name);
  const out = new Set<string>([n]);
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    const all = [canonical, ...aliases].map(normalizeName);
    if (all.some((a) => n === a || n.includes(a) || a.includes(n))) {
      all.forEach((a) => out.add(a));
      out.add(canonical);
    }
  }
  return [...out];
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ea = expandAliases(a);
  const eb = expandAliases(b);
  return ea.some((x) => eb.includes(x));
}
