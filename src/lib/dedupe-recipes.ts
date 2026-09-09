/**
 * Shared catalog (householdId null) plus household copies of the same staples
 * must not appear twice in lists / Cook Now.
 * Prefer the active household's row when titles collide.
 */
export function normalizeRecipeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

type Dedupeable = {
  title: string;
  householdId?: string | null;
  id?: string;
};

export function dedupeRecipesByTitle<T extends Dedupeable>(
  recipes: T[],
  activeHouseholdId: string | null
): T[] {
  const best = new Map<string, T>();
  for (const recipe of recipes) {
    const key = normalizeRecipeTitle(recipe.title || "");
    if (!key) continue;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, recipe);
      continue;
    }
    const preferNew =
      activeHouseholdId != null &&
      recipe.householdId === activeHouseholdId &&
      existing.householdId !== activeHouseholdId;
    const preferExisting =
      activeHouseholdId != null &&
      existing.householdId === activeHouseholdId &&
      recipe.householdId !== activeHouseholdId;
    if (preferNew) {
      best.set(key, recipe);
    } else if (preferExisting) {
      // keep existing
    } else if ((recipe.id || "") > (existing.id || "")) {
      // stable-ish tie-break
      best.set(key, recipe);
    }
  }
  // Preserve original order of first-seen winners' relative order by scanning again
  const kept = new Set(best.values());
  const out: T[] = [];
  const emitted = new Set<string>();
  for (const recipe of recipes) {
    const key = normalizeRecipeTitle(recipe.title || "");
    const winner = best.get(key);
    if (!winner || emitted.has(key)) continue;
    if (winner === recipe || winner.id === recipe.id) {
      out.push(winner);
      emitted.add(key);
    }
  }
  // Any winners not emitted (shouldn't happen) — append
  for (const [key, recipe] of best) {
    if (!emitted.has(key) && kept.has(recipe)) {
      out.push(recipe);
      emitted.add(key);
    }
  }
  return out;
}
