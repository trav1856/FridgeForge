# Weekly menu builder

**Path:** `/menu` (nav: **Weekly menu**)

Builds a **7-day** breakfast / lunch / dinner plan from the **active pantry** and available recipes (shared catalog + household scope — same as Cook Now).

## How picks work

1. Score recipes with Cook Now logic (`suggestMeals` / `scoreRecipe`): pantry match ratio, can-make-now / near-miss, affordability, optional Struggle Mode boosts.
2. Filter each slot by **course** (`breakfast` / `lunch` / `dinner` / `main` / …) plus title/tag heuristics when `course` is empty.
3. Walk Mon–Sun (actually next 7 calendar days). For each slot, pick the highest adjusted score, subtracting a **repeat penalty** so the same recipe is avoided when alternatives exist. Also avoid repeating a recipe twice in the same day when possible.
4. Soft fallback: if a course pool is empty, use general non-dessert recipes so the week still fills.

## Actions

- **Regenerate week** — rebuild all 21 slots.
- **Refresh** on a slot — regenerate that day/meal only (excludes the previous pick).
- **Send missing to shopping list** — posts unique missing ingredient names via `/api/shopping-list`.

## Persistence

`WeeklyMenuPlan` (Prisma) stores `planJson` per household (or per user without household). Guests get an in-session plan only.

API: `GET/POST /api/weekly-menu`
