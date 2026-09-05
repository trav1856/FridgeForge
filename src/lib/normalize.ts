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

/** Compounds where the head noun must not match the standalone staple. */
const FALSE_FRIENDS: [string, string][] = [
  ["peanut butter", "butter"],
  ["cocoa butter", "butter"],
  ["pasta sauce", "pasta"],
  ["pasta sauce", "spaghetti"],
  ["apple butter", "butter"],
];

export function expandAliases(name: string): string[] {
  const n = normalizeName(name);
  const out = new Set<string>([n]);
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    const all = [canonical, ...aliases].map(normalizeName);
    // Exact membership only — avoids "peanut butter" joining the butter family.
    if (all.includes(n)) {
      all.forEach((a) => out.add(a));
      out.add(canonical);
    }
  }
  return [...out];
}

function isFalseFriendPair(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return FALSE_FRIENDS.some(
    ([full, part]) =>
      (na === full && (nb === part || expandAliases(b).includes(part))) ||
      (nb === full && (na === part || expandAliases(a).includes(part)))
  );
}

/** True if needle appears in haystack on word boundaries. */
function phraseIncludes(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  if (haystack === needle) return true;
  return ` ${haystack} `.includes(` ${needle} `);
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (isFalseFriendPair(a, b)) return false;

  // Prefer word-boundary phrase containment over raw substring
  // so "butter" does not match inside "peanut butter".
  if (phraseIncludes(na, nb) || phraseIncludes(nb, na)) {
    if (isFalseFriendPair(a, b)) return false;
    // If longer phrase is a known false-friend compound vs shorter staple, block
    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length <= nb.length ? nb : na;
    if (
      FALSE_FRIENDS.some(
        ([full, part]) => longer === full && shorter === part
      )
    ) {
      return false;
    }
    return true;
  }

  const ea = expandAliases(a);
  const eb = expandAliases(b);
  if (ea.some((x) => eb.includes(x))) {
    if (isFalseFriendPair(a, b)) return false;
    return true;
  }
  return false;
}
