# Recipe taxonomy (cuisine, course, food, origin)

Recipes carry structured fields (preferred over free tags alone):

| Field | Type | Purpose |
| --- | --- | --- |
| `cuisine` | string | Broad cuisine chip (Mexican, Italian, Asian, …) |
| `course` | string | breakfast / lunch / dinner / main / side / starter / dessert / snack / drink |
| `foodCategories` | JSON string[] | Primary food types: dairy, meat, vegetable, fruit, grain, … |
| `origins` | JSON string[] | Ethnicity / national-origin **foodways** ids (overlapping OK) |
| `tags` | JSON string[] | Free tags (struggle, weeknight, …) — still supported |

Controlled vocab lives in `src/lib/recipe-taxonomy.ts`.

## Origin hierarchy

UI lists origins by **continent/region** (Africa → Asia → Europe → Middle East / Levant → North America → South America / Latin America → Pacific Rim / Oceania / Polynesia), then A–Z within each group — never a flat list that puts one culture first. Nested labels (e.g. Ashkenazi under Jewish) still roll up for filters.


Selecting a parent matches that id **or any descendant**. Example: filter `origin=jewish` includes recipes tagged `ashkenazi-jewish`, `sephardi-jewish`, `israeli-jewish`, etc. Selecting `ashkenazi-jewish` is narrow.

Origins are culinary/cultural foodways labels (e.g. Jewish, Muslim-friendly, Levantine, Chinese). Recipes may list several overlapping origins (hummus → Levantine + Arabic + Israeli + Jewish + Muslim-friendly when appropriate). Leave unknown empty rather than guessing.

## API

`GET /api/recipes` (and admin list) accept:

- `q` — search title, tags, cuisine, course, food categories, origins, ingredients
- `cuisine`, `course`, `foodCategory`
- `origin` or `ethnicity` — hierarchical match

`/recipes` UI mirrors these as shareable URL query params.

## Seed / backfill

Non-destructive seed infers taxonomy for staples via heuristics and fills empty fields only. No `FF_FORCE_RESET` on production.

## Origin story (`originStory`)

Optional short prose on the recipe. Recipe detail shows a **Learn more / Story behind this food** expander when set; empty hides the section. Admin and create form can edit it. Seed backfills brief original blurbs for selected staples (`src/lib/recipe-origin-stories.ts`).

Filter UI: cuisine/course keep **Any cuisine** / **Any course**; food filter clear control is labeled **Food type**. Origins are grouped by continent/region then A–Z.
