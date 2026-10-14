# Private demographics, My taste, research analytics

- **Private details** (`/account/profile`): optional sex (Male/Female/blank), ethnicity/heritage multi-select, family-origin countries (max 12). Stored in `UserDemographics` (1:1, cascade on user delete), only read by `/api/account/demographics` (owner) and the aggregate analytics. Never on public profiles.
- **Research consent**: exact text in `CONSENT_TEXT`. Turning it on requires a DOB check showing 16+; the DOB is not stored, only `age16ConfirmedAt`. Unchecking clears consent and the confirmation (opt-out). Disclosure + opt-out at `/privacy`.
- **View tracking**: signed-in recipe opens upsert `RecipeView` (one row per user/recipe/UTC day, `views` counter, cuisine snapshot). Favorites come from `RecipeFavorite`. Users see a private "My taste" panel and can clear their view history.
- **Analytics** (`/admin/analytics`): cohort = consented + 16-confirmed + not disabled. Breakdowns by sex, ethnicity, origin country, origin region (derived from country). Multi-select users count in each group. k = 20: a cohort/group under 20 users is omitted; a cell (views or favorites) backed by under 20 users shows `<20`.
- **Executive summary**: `/api/admin/analytics/export?format=pdf|csv`, admin-only, same-origin, appends an `analytics.export` audit entry. Aggregates only; no names, emails, or ids.
- **Exports**: full and single-user exports include both tables (dmmf). Content export uses the `CONTENT_MODELS` allow-list and excludes them (tested).
