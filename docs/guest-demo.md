# Guest demo mode

Guests (not signed in) never write to the database.

| Area | Guest | Signed in |
|---|---|---|
| Pantry | **Demo pantry**: 17-item fixture in `localStorage` (`ff_demo_pantry_v1`, `src/lib/demo-pantry.ts`). Add / edit / delete locally; **Reset demo** restores it. | Household pantry (starts empty; optional **Add starter staples** → `POST /api/pantry/starter`). |
| Cook Now, % match, weekly menu, recipe "you have enough", deals | Read-only POSTs that carry the local pantry: `POST /api/suggestions`, `POST /api/suggestions/deals`, `POST /api/weekly-menu` (`action: "build"`). Nothing is stored. | Server pantry (`GET`). |
| "I'm cooking this" | Deducts from the demo pantry in the browser (`planPantryDeductions`); Cancel restores it. | Server cook session. |
| Shopping list | `localStorage` (`ff_guest_shopping_v1`, `src/lib/local-shopping-list.ts`). The API returns `[]` for `GET` and 401 for writes. | Household list (or personal list without a household). |
| Coupons | Static samples (`src/lib/sample-coupons.ts`): generic names, no brands or prices, no codes, watermark "SAMPLE — NOT VALID", no clip / use / print / create. | Own household's coupons only. |
| Recipes | Browse; `POST /api/recipes` returns 401. | Create / import. |

Demo data is never copied into an account. Signed-in users without a household
(legacy) see the demo pantry in the UI too, since server pantry writes need a household.

The shared null-household pool was retired by migration
`20261006230000_retire_shared_pool` (deletes null-scope pantry items, custom
staples, coupons and anonymous shopping rows; pantry/staples/coupons now cascade
when a household is deleted). Recipes keep `ON DELETE SET NULL` because a null
recipe household means "shared catalog"; the only household delete path
(`deleteUser` in `src/lib/admin-users.ts`) deletes private recipes first.
