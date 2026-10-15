# Diet plans + nutrition snapshots

## Nutrition data
- `src/lib/recipe-nutrition.ts` (estimator v2): 34 new table entries (dry pasta, raw rice, whole chicken, ramen, broccoli, banana, chocolate chips, apples, canned pumpkin, shortening, prunes, apricots, walnuts, OJ, orange zest, kimchi, sesame, hoisin, mirin, teriyaki, sour cream, peas, bell pepper, spices, leaveners, vanilla, bay, basil).
- Units: `can` = entry `gPerCan` or 400 g; `package` only when the entry knows its size (pasta 454 g).
- Pasta given by weight/package counts as **dry** pasta. Rice counts as **raw** when the name or steps say so ("rinse/cook/boil rice"), as cooked when they say "cold/leftover/cooked rice", and otherwise is assumed cooked (recorded in `assumptions`).
- "2 each | tsp. sesame seeds" style lines lift the unit out of the name.
- Whole recipe = per-serving × servings, exactly, so the card toggle and plan portions agree.
- `RecipeNutritionSnapshot` (1:1 with Recipe) stores per-serving macros, coverage, `trusted`, `reasons`, `assumptions`, `unmatched`. It's recomputed lazily when the inputs hash or estimator version changes. `servingsSuspect`/`servingsNote` are manual admin flags that survive recomputes.
- **Trusted** = every non-minor ingredient matched (minor = tsp amounts or ≤1 tbsp), 50–1,500 kcal per serving, and servings not flagged.
- Admin › Nutrition: coverage table, "Untrusted only" filter, Recompute all, Flag servings (both audited).

## Diet plans (/menu?mode=diet, setup at /menu/diet)
- `UserDietSettings`: diet type, kcal target, meals/day (2–5), optional macro split, tolerance ±10%, age band (from a DOB check, DOB not stored), and when the disclaimer was accepted. Under-18: balanced only, ≥1,600 kcal, no custom split.
- Rules (`src/lib/diet/rules.ts`):
  - keto ≤10 g net carbs/meal, ≤25 g/day, no grains or starches;
  - low-carb ≤30 g/meal, ≤100 g/day;
  - high-protein ≥25 g and ≥30% of kcal;
  - Mediterranean saturated fat ≤10% of kcal, soft fiber ≥5 g, no processed meat, red meat ≤2 meals/week (soft);
  - vegetarian/vegan/pescatarian use recipe flags.
- Planner (`src/lib/diet/planner.ts`):
  - greedy slot fill aimed at the remaining budget, with portions ½–2;
  - repair pass of up to 50 single-slot swaps;
  - lock, swap (top 5 with deltas) and portion changes;
  - honest short/over/cap/empty messages.
- Pool = recipes the user can read, minus allergen conflicts (**hard exclude**) and account plant/macro prefs (strict; adapt notes don't count), with only trusted snapshots used.
- Exports: full and user exports include the new tables; content export doesn't.
