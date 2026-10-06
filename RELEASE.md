# FridgeForge release checklist (internal)

Run through this before tagging or deploying a release.

## Prep
- [ ] Start from current `main`: `git pull --ff-only`
- [ ] Bump `version` in `package.json` (semver; `-alpha` / `-beta` while pre-1.x features are gated)
- [ ] Update the release history below with a short summary

## Verify
- [ ] Type check: `npx tsc --noEmit` (no new errors)
- [ ] Unit tests: `bun run test` (full Vitest suite green)
- [ ] Production build: `bun run build`
- [ ] Smoke test signed out (`/` splash, `/recipes`) and signed in (`/account`, `/pantry`, `/suggestions`, `/coupons`, `/admin` as admin) — no console or hydration errors
- [ ] Server log clean after the smoke test

## Database
- [ ] Back up Postgres before deploying (see docs/postgres.md)
- [ ] Apply schema changes with `prisma migrate deploy` — never `db:seed:reset` on a real database
- [ ] Run the safe seed (`bun run db:seed`) only if new staples/content need to be ensured

## Ship
- [ ] Commit, tag (`vX.Y.Z[-pre]`), and push
- [ ] Restart the app and re-check the log
- [ ] Note anything gated or deferred in PAID.md

## Release history

### v1.1.0-alpha — 2026-09-05
- Auth + households APIs and /account UI landed; see PAID.md.
- Guest single-user path unchanged (householdId null).
- Pro features remain gated.

### v1.0.0 — 2026-09-05
- Pantry CRUD with barcode-first UPC intake (Open Food Facts)
- Recipes (manual + URL import with images)
- Smart suggestions + Struggle Meal mode
- Demo manufacturer coupons + deals banner for missing ingredients
- Receipt intake under Advanced (experimental)
