# FridgeForge

**Cook great food from what you already have — especially on a budget.**

FridgeForge is a mobile-first web app for pantry tracking, recipes, and smart meal suggestions. **Struggle Meal mode** optimizes for inexpensive staples (rice, beans, eggs, pasta, canned goods) turned into food you are proud to plate — with technique tips and cheap flavor boosters (soy, vinegar, spices, citrus).

## Product vision

Too many meal apps assume a full grocery run. FridgeForge starts from scarcity and creativity: what is in the cupboard, what can you make tonight, and how do you make it taste like you meant it?

## MVP (this repo)

- Pantry CRUD — name, qty, unit, category/tags, optional expiration
- Recipes — manual add, cost tier, tags, struggle flag, tips/boosters
- URL import — best-effort HTML/JSON-LD scrape with manual fallback
- Smart suggestions — pantry match + affordability + creative notes
- Struggle Meal mode — toggle, prioritize cheap/struggle recipes
- Seed data so first open feels alive

## Out of scope / roadmap

Not in v1 (documented for later only):

- Grower marketplace
- Shipping / fulfillment
- Diet mode
- Bank linking
- Trend analytics

## Tech stack

- Next.js App Router + TypeScript + React
- Tailwind CSS (warm, food-friendly UI)
- SQLite via Prisma
- Vitest for suggestion matching unit tests
- Cheerio for recipe page parsing

## How to run

```bash
cd FridgeForge
cp .env.example .env
# DATABASE_URL=file:./dev.db
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000

### Useful scripts

- npm run dev — Dev server
- npm run build — Production build
- npm run db:setup — Push schema + seed
- npm run db:seed — Re-seed only
- npm test — Unit tests (suggestion logic)

## Project structure

```
src/app/           # App Router pages + API routes
src/components/    # UI
src/lib/           # db, suggestions, scrape, normalize
prisma/            # schema + seed
__tests__/         # Vitest
```

## Suggestion scoring (brief)

Recipes are scored by pantry match ratio, can-make-now / near-miss (at most 2 cheap missing staples), cost tier, and Struggle Meal boosts. Creative pairing notes (e.g. peanut + cabbage) surface when relevant.

## License

MIT — built as an MVP scaffold.
