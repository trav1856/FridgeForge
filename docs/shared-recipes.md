# Shared vs household recipes

FridgeForge has two recipe classes:

| Class | Storage | Who sees it |
| --- | --- | --- |
| **System / shared catalog** | `Recipe.householdId = null` | Everyone (guests and signed-in) |
| **Household / personal** | `Recipe.householdId = <household>` | That household only |

## Reads

- **Guests:** shared catalog only (`householdId: null`).
- **Signed-in household:** shared **OR** their household — `recipeScopeWhere(householdId)`.
- **Pantry** stays exact-scoped via `householdWhere` (never merge pantry across households).

Coupons already used the same shared-or-household OR pattern; recipes now mirror it.

## Recipe of the week

Homepage section below **Flavor on a Budget** picks Breakfast / Lunch / Dinner from the shared catalog. Picks are seeded by ISO week + meal slot so they stay stable mid-week. Classification uses tags (`breakfast` / `lunch` / `dinner`, plus a few aliases) then title heuristics; empty slots fall back to other shared recipes.
