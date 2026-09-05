# FridgeForge Community Edition

**Status: stable CE · v1.1.0-alpha (paid-track scaffold)**

**Cook great food from what you already have — especially on a budget.**

This repository is the **Community Edition** — Apache-2.0, self-hostable, barcode-first pantry + recipes + struggle meals + demo coupons. The paid/cloud edition (households, live manufacturer deals network, priority support, Learn certificates sync) will be developed separately.


FridgeForge is a mobile-first web app for pantry tracking, recipes, and smart meal suggestions. **Struggle Meal mode** optimizes for inexpensive staples (rice, beans, eggs, pasta, canned goods) turned into food you are proud to plate — with technique tips and cheap flavor boosters (soy, vinegar, spices, citrus).

## Product vision

Too many meal apps assume a full grocery run. FridgeForge starts from scarcity and creativity: what is in the cupboard, what can you make tonight, and how do you make it taste like you meant it?

## Community Edition (this repo — stable)

- Pantry CRUD — name, qty, unit, category/tags, optional expiration + barcode
- **Barcode-first intake** — primary path: camera scan or type UPC/EAN → Open Food Facts → confirm → pantry (manual add remains secondary)
- **Receipt intake (experimental)** — demoted under Advanced; photo OCR / paste still available but not a peer primary tab
- Recipes — manual add, cost tier, tags, struggle flag, tips/boosters
- URL import — best-effort HTML/JSON-LD scrape (browser-like headers + one 403/429 retry) with manual fallback
- Recipe images — scraped from the page, else a free food photo, else a branded placeholder
- Smart suggestions — pantry match + affordability + creative notes
- Struggle Meal mode — toggle, prioritize cheap/struggle recipes
- **Coupons** — clip sample manufacturer offers, filter active/expired/used, bright redeem view with QR/barcode
- **Recipe deals** — when a dish is missing ingredients, match active coupons and show “You have deals available for this dish” (suggestions + recipe detail → redeem)
- Seed data so first open feels alive

## Out of scope / roadmap

Not in Community Edition / early paid (documented for later):

- Grower marketplace
- Shipping / fulfillment
- Diet mode
- Bank linking
- Real manufacturer portal / GS1 coupon standards
- **Restaurant sales pulse** — restaurants submit daily dish sales → trending plates + prep/grocery planning
- **Recipe sharing** — private (default), household-only, public free release, or invite-only to selected households
- **Supplier demand match** — suppliers see which restaurants (and households) need produce (e.g. okra, potatoes) and connect directly
- Broader trend analytics (consumer + F&B)


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

**Strategy:** barcode-first. The reliable happy path is scan/type a UPC when you get home, look it up on Open Food Facts, confirm, and merge into pantry. Manual entry stays available as a secondary tab. Receipt OCR remains in the codebase but is **experimental** — collapsed under “Advanced: try receipt (experimental)” so it does not compete as a primary peer tab.

### Barcode scanning (primary)

1. Open Pantry — **Scan barcode** is the default tab
2. Tap Open camera or type a barcode and Look up
3. Product data comes from Open Food Facts via /api/barcode/lookup
4. Confirm name / qty / unit / category
5. Item is created or merged (same barcode, or same name+unit)

If there is no match, add the name manually on the confirm form; barcode is saved for next time. Use the **Manual** tab for free-form pantry items without a barcode.

Limitations: coverage varies; camera needs localhost or TLS and consent.

### Receipt scanning (experimental / Advanced)

Receipt is intentionally demoted in the UI. Resolver and OCR code are kept; do not treat this as the main intake path.

1. Open Pantry → expand **Advanced: try receipt (experimental)**
2. Upload or capture a receipt photo (Tesseract.js in the browser)
3. Or paste text instead and parse
4. Review the checklist — **resolved food names** are the editable default (not raw `GV` / `GRP` codes)
5. Bulk-add via /api/pantry/bulk (merge-aware; barcodes stored when detected)

**Resolver pipeline** (`src/lib/receipt-resolve.ts`):

1. Parse line items (`receipt-parse`)
2. Extract UPC/EAN (8–14 digits) from the line — not prices or short PLUs
3. If UPC found → Open Food Facts lookup; prefer that product name/brand/category
4. Else expand store brands (`GV`→Great Value, `MS`→Marketside, …) and product abbrevs (`GRP`→grapes, `CHK`→chicken, …), plus pack counts (`10 COUNT`, `12CT`, `6 PK`)
5. Optional: if `OLLAMA_HOST` is reachable, low-confidence lines may get a local LLM suggestion (fail-open)

UI shows muted **Receipt said: …**, optional UPC used, and a **check this one** badge when confidence is low. Works fully offline via the dictionary when OFF/Ollama are unavailable.

Limitations: OCR quality depends on lighting and print; heuristic parsing may miss odd layouts — always review. OCR stays on-device; extracted text is posted to the local parse route.

## Coupons

1. Open **Coupons** in the nav
2. Filter Active / Clipped / Expired / Used
3. **Clip / save** or open **Redeem view** (large discount text + QR or Code128)
4. Use **Bright mode** at the register; mark used when done
5. **Create demo coupon** is a local manufacturer/admin stub (no auth)

### Deals on recipes / suggestions

If you open a recipe (or a suggestion card) and you are **missing** one or more ingredients, FridgeForge fuzzy-matches those names against **active** coupons (brand, title, discount text, code keywords). When there is a hit, a warm banner says you have deals for that dish and links to `/coupons/[id]` redeem.

- Fully stocked dishes (or missing items with no coupon match) hide the banner.
- API: `GET /api/suggestions/deals?recipeId=` (also attached as `deals` on `/api/suggestions`).
- Seed leaves pasta, beans, and tomatoes out of the pantry so struggle meals demo the banner with pasta / sauce / beans / butter coupons.

Roadmap (not in MVP): authenticated manufacturer portal, GS1 digital coupon standards, retailer POS validation.


## Recipe URL import + images

Paste a recipe page URL on **Add / import recipe**. The server fetches the HTML with a Chrome-like User-Agent and common browser headers (Accept-Language, Sec-Fetch-*, Referer). Many recipe hosts (Cloudflare / Akamai / bot walls) **403 the first request** when the old `FridgeForge/0.1` agent was used; the importer now retries **once** after a short backoff on 403/429 so you do not need to click Import twice. The button is disabled while the request is in flight. If the site still blocks, you get a clear “blocked — paste manually” message.

### Image strategy

`Recipe.imageUrl` stores a remote URL (or a local `/recipe-images/...` path). No paid API key.

1. **Scrape** — JSON-LD `Recipe.image` → `og:image` → `twitter:image` → first large content `<img>`
2. **Foodish** — `https://foodish-api.com/api/` (free, no key; category hint from the title when possible)
3. **Branded fallback** — `/recipe-images/placeholder.svg`, or a client-side gradient + title initials if the remote image fails to load

Seed recipes use **Lorem Flickr** food photos keyed by title (`https://loremflickr.com/800/600/food,{keyword}?lock={hash}`) so they stay stable across re-seeds. `source.unsplash.com` is deprecated and is not used.

Override the scrape User-Agent with `SCRAPE_USER_AGENT` in `.env` if a site still rejects the default Chrome UA.

## Project structure

    src/app/           App Router pages + API routes
    src/components/    UI (BarcodeIntake, ReceiptIntake, Coupons*)
    src/lib/           db, suggestions, scrape, recipe-image, normalize, OFF + receipt parse/resolve
    public/recipe-images  branded SVG placeholder
    prisma/            schema + seed
    __tests__/         Vitest

## Suggestion scoring (brief)

Recipes are scored by pantry match ratio, can-make-now / near-miss (at most 2 cheap missing staples), cost tier, and Struggle Meal boosts. Creative pairing notes (e.g. peanut + cabbage) surface when relevant.



## Paid track (in progress)

Auth + households scaffold the paid/cloud edition. **Guest / CE mode still works without login** (nullable householdId).

- Sign up / sign in at **/account**
- Create or join a household (invite code)
- Seeded Pro demo: `pro@fridgeforge.local` / `prodemo`
- Demo coupons remain free; Pro gates live manufacturer deals (`src/lib/edition.ts`)
- Details: [PAID.md](./PAID.md)

## Pricing (working)

- Self-host CE: free, ad-free, offline
- Self-host Network: $1.99/mo (join cloud network)
- Cloud Free: full app + light manufacturer banner ads
- Cloud Pro: $4.99/mo, no ads + Pro network features

## License

Apache-2.0 — see LICENSE and NOTICE. Free to use and modify; keep copyright and attribution.
