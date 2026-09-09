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

## Featured meals (Breakfast / Lunch / Dinner)

Homepage section below **Flavor on a Budget** picks Breakfast / Lunch / Dinner from the shared catalog (`householdId: null`). Picks are **random on every page load** (not ISO-week stable). Classification uses tags (`breakfast` / `lunch` / `dinner`, plus a few aliases) then title heuristics; empty slots fall back to other shared recipes so the trio stays filled when the catalog allows.

## Popular this week

Below the B/L/D trio, a trending strip prefers recipes with favorites in the last 7 days, then all-time favorites, then a shuffled sample of the shared catalog. Only eligible recipes appear (shared catalog, or household recipes marked `visibility: public`). Fallback never invents favorite counts.

## Recipe requests (social-lite)

Signed-in users can ask “Can I have that recipe?” for a household-owned recipe that is not already in their scope (shared catalog is already everyone’s — no CTA). The owner sees pending requests on **Account** and can Accept (copies recipe + ingredients into the requester’s household) or Decline. Public-visibility household recipes are readable outside the owner household so the request CTA can appear on the detail page.
