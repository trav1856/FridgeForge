# FridgeForge

**Cook great food from what you already have — especially on a budget.**

FridgeForge is a mobile-first web app for pantry tracking, recipes, and smart meal suggestions. **Struggle Meal mode** optimizes for inexpensive staples (rice, beans, eggs, pasta, canned goods) turned into food you are proud to plate — with technique tips and cheap flavor boosters (soy, vinegar, spices, citrus).

## Product vision

Too many meal apps assume a full grocery run. FridgeForge starts from scarcity and creativity: what is in the cupboard, what can you make tonight, and how do you make it taste like you meant it?

## MVP (this repo)

- Pantry CRUD — name, qty, unit, category/tags, optional expiration + barcode
- **Barcode intake** — camera scan or manual UPC/EAN; Open Food Facts lookup; confirm qty/category; merge into pantry
- **Receipt intake** — photo/camera upload with in-browser OCR (Tesseract.js) or paste text; review checklist; bulk-add
- Recipes — manual add, cost tier, tags, struggle flag, tips/boosters
- URL import — best-effort HTML/JSON-LD scrape with manual fallback
- Smart suggestions — pantry match + affordability + creative notes
- Struggle Meal mode — toggle, prioritize cheap/struggle recipes
- **Coupons** — clip sample manufacturer offers, filter active/expired/used, bright redeem view with QR/barcode
- Seed data so first open feels alive

## Out of scope / roadmap

Not in v1 (documented for later only):

- Grower marketplace
- Shipping / fulfillment
- Diet mode
- Bank linking
- Trend analytics
- Real manufacturer portal / GS1 coupon standards

## Tech stack

- Next.js App Router + TypeScript + React
- Tailwind CSS (warm, food-friendly UI)
- SQLite via Prisma
- Vitest for suggestion + receipt-parse unit tests
- Cheerio for recipe page parsing
- **html5-qrcode** — mobile-friendly barcode camera scanner
- **tesseract.js** — on-device receipt OCR (no server GPU/native binaries)
- **Open Food Facts** — free public product API (`/api/v2/product/{barcode}.json`)

## How to run

```bash
cd FridgeForge
cp .env.example .env
# DATABASE_URL=file:./dev.db
bun install
bun run db:setup
bun run dev
```

Open http://localhost:3000
### Useful scripts

- bun run dev
- bun run build
- bun run db:setup

- bun run db:seed
- bun run db:push
- bun run test

## Pantry intake features

### Barcode scanning

1. Open Pantry, then the Barcode tab
2. Tap Open camera or type a barcode and Look up
3. Product data comes from Open Food Facts via /api/barcode/lookup
4. Confirm name / qty / unit / category
5. Item is created or merged (same barcode, or same name+unit)

If there is no match, add manually; barcode is saved for next time.

Limitations: coverage varies; camera needs localhost or TLS and consent.

### Receipt scanning

1. Open Pantry, then the Receipt tab
2. Upload or capture a receipt photo (Tesseract.js in the browser)
3. Or paste text instead and parse
4. Review the checklist (toggle, edit names/qtys/categories)
5. Bulk-add via /api/pantry/bulk (merge-aware)

Limitations: OCR quality depends on lighting and print; heuristic parsing may miss odd layouts — always review. OCR stays on-device; extracted text is posted to the local parse route.

## Coupons

1. Open **Coupons** in the nav
2. Filter Active / Clipped / Expired / Used
3. **Clip / save** or open **Redeem view** (large discount text + QR or Code128)
4. Use **Bright mode** at the register; mark used when done
5. **Create demo coupon** is a local manufacturer/admin stub (no auth)

Roadmap (not in MVP): authenticated manufacturer portal, GS1 digital coupon standards, retailer POS validation.

## Project structure

    src/app/           App Router pages + API routes
    src/components/    UI (BarcodeIntake, ReceiptIntake, Coupons*)
    src/lib/           db, suggestions, scrape, normalize, OFF + receipt parse
    prisma/            schema + seed
    __tests__/         Vitest

## Suggestion scoring (brief)

Recipes are scored by pantry match ratio, can-make-now / near-miss (at most 2 cheap missing staples), cost tier, and Struggle Meal boosts. Creative pairing notes (e.g. peanut + cabbage) surface when relevant.

## License

MIT — built as an MVP scaffold.
