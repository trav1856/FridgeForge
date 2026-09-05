# FridgeForge — Investor Prospectus

**Turn what’s in your fridge into great cheap meals.**

| | |
|---|---|
| **Document** | Investor Prospectus (confidential draft) |
| **Company** | FridgeForge |
| **Stage** | Pre-seed / seed exploration — early MVP live |
| **Repo** | https://github.com/trav1856/FridgeForge (public) |
| **Date** | September 2026 |
| **Status** | Draft for founder review — figures labeled as proposed or illustrative |

---

## Executive summary (1 page)

**FridgeForge** helps households cook great food from what they already have — especially on a tight budget. The product starts from pantry reality, not an idealized grocery list: scan what’s on the shelf, get struggle-meal suggestions that taste intentional, clip manufacturer deals when ingredients are missing, and (over time) learn foundational cooking skills.

**Problem.** Meal apps and store coupon silos assume either a full grocery run or a recipe collection in isolation. Families under budget pressure waste food, default to takeout, or cook the same three bland meals. Self-host recipe managers (e.g. Mealie) serve enthusiasts; consumer meal planners (Mealime, Paprika, Yummly) optimize for plans and catalogs; retailer apps keep coupons trapped in one chain. Few products connect **what’s in the fridge** + **affordable cooking** + **deals** + **skills**.

**Solution (MVP today).** A responsive Next.js web/PWA with:

- Pantry CRUD and **barcode-first** UPC intake via Open Food Facts (manual add secondary)
- Recipes, URL import, **Struggle Meal mode**, and smart suggestions from pantry match + affordability
- Coupons (demo/seed data today; manufacturer portal is a GTM goal, not a signed contract)
- Deals banner when a dish is missing ingredients that match active coupons
- Receipt OCR available under Advanced only (experimental; unreliable — barcode-first is the deliberate path)

**Platform.** Web/PWA first — phones, tablets, Echo Show browser, desktop. Native iOS/Android later. No separate Show app.

**Business model (proposed open-core freemium).** Free/community tier (including optional self-host of core): pantry, barcode, recipes, struggle meals, suggestions, basic Learn later. Cloud subscription **~$4.99/mo (proposed)** for manufacturer coupons, smarter deals, priority support, household sharing, synced Learn certificates. Optional self-host supporter **~$1.99/mo (proposed)** — lower price because the customer brings infrastructure, still pays for coupon/deals network access. **No manufacturer contracts claimed today**; those are a go-to-market objective.

**Ask.** Seed amount **TBD**. Sample use-of-funds outline with blanks is in §12. Traction metrics and revenue are **not** invented here — the product is early MVP; this document uses clearly labeled projections and assumptions only.

**Thesis in one line:** Own the “cook from what you have, cheaply and well” wedge — pantry truth + struggle cooking + deals network + education — then expand into households, learning certificates, nutrition/body insights (estimates), and (later) local food and scale integrations.

---

## 1. Cover / title

# FridgeForge

### Investor Prospectus

**One-liner:** Turn what’s in your fridge into great cheap meals — with struggle-meal cooking, barcode pantry intake, local-food roadmap, and manufacturer deals.

**Building with:** Technical partner/assistant · Early MVP (Next.js) · Public repo: [github.com/trav1856/FridgeForge](https://github.com/trav1856/FridgeForge)

**Team:** *[Placeholder — founder to fill: name(s), roles, brief background. Do not invent bios.]*

**Contact:** *[Email / calendar link TBD]* · **Location:** *[TBD]*

---

## 2. Problem

### People don’t cook from empty fantasy kitchens

Most meal software starts with a recipe catalog or a weekly plan that assumes you will buy everything. Real life looks different:

1. **The fridge is half-full and mismatched.** Leftover rice, two eggs, a lonely jar of salsa, and something expiring tomorrow. “What can I make?” is the actual question — not “what’s trending on Yummly.”
2. **Budget pressure is constant.** Struggle meals get a bad reputation as sad and beige. People want food they are proud to plate without spending like a food blogger.
3. **Coupons and pantry don’t talk.** Manufacturer and store offers live in retailer apps or paper. They rarely meet “I’m cooking this dish tonight and I’m missing one item.”
4. **Skills gap.** Many adults never learned foundational techniques. Recipe apps don’t teach knife skills or how to season; cooking schools and celebrity courses are expensive or intimidating.
5. **Fragmentation.** Recipe managers, meal planners, store apps, and budgeting tools each own a slice. Switching costs and context loss are high.

**Who hurts most:** Budget-conscious households, students, young families, anyone cooking under constraint who still cares about taste and dignity at the table.

---

## 3. Solution

**FridgeForge** is a pantry-first cooking companion:

| Pillar | What it does |
|--------|----------------|
| **Pantry truth** | Barcode-first intake (Open Food Facts) + manual add so the app knows what’s actually on hand |
| **Struggle Meal mode** | Optimize for inexpensive staples (rice, beans, eggs, pasta, canned goods) with techniques and cheap flavor boosters (soy, vinegar, spices, citrus) |
| **Smart suggestions** | Match recipes to pantry + affordability; surface creative notes, not just exact matches |
| **Deals bridge** | When a dish is missing ingredients, show matching manufacturer coupons (“You have deals available for this dish”) |
| **Learn to Cook (roadmap)** | Beginner path from boil water → knife skills → foundational methods, with lesson certificates and credible chef endorsement (chef TBD — **not** Jamie Oliver) |
| **Nutrition & body (roadmap)** | Per-recipe calorie/macro **estimates**; optional body profile (height, weight, BMI, progress); Withings scale sync later |
| **Local food (later)** | Grower marketplace / farm-to-table as a later expansion, not MVP |

**Design principle:** Start from scarcity and creativity. Make cheap food taste like you meant it.

---

## 4. Product & screenshots

> **Screenshots:** TBD — placeholders below describe the intended UI for a future deck insert.

### Navigation (target IA)

**Home · Pantry · Recipes · Cook Now · Coupons · Learn to Cook**

### What’s live in the MVP (approx.)

| Area | Status | Notes |
|------|--------|--------|
| Pantry CRUD | Live | Name, qty, unit, category/tags, optional expiration + barcode |
| Barcode scan / UPC lookup | Live | Primary intake path; Open Food Facts; camera or type |
| Manual pantry add | Live | Secondary tab |
| Recipes + URL import | Live | Cost tier, tags, struggle flag, tips/boosters; best-effort scrape |
| Struggle Meal mode | Live | Toggle; prioritize cheap/struggle recipes |
| Smart suggestions | Live | Pantry match + affordability |
| Coupons | Demo / seed | Clip sample offers; redeem view with QR/barcode; **not** live manufacturer contracts |
| Recipe deals banner | Live | Missing ingredients × active coupons |
| Receipt OCR | Experimental | Advanced only; unreliable — demoted by design |
| Auth / multi-user | Not shipped | SQLite local demo; household sharing is roadmap |
| Recipe finished-dish photos | Roadmap | Images of plated results |
| Learn to Cook | Roadmap | Curriculum + certificates |
| Grower marketplace | Later | Explicitly out of v1 |
| Per-recipe nutrition (cal + macros) | Roadmap (Next) | Estimated from ingredients; labeled as estimates; visible on recipe/cook; export CSV/PDF |
| User body profile | Roadmap (Next) | Height, weight, BMI, progress over time |
| Withings smart scale | Roadmap (Later) | Integration for weight sync (user referred to as "Wise") |
| Diet mode | Later | Soft accountability; careful privacy |

### UI placeholders (describe for design / photo shoot)

1. **Home** — Warm food-brand energy; “Cook from what’s here” hero; tonight’s suggestions; struggle toggle; deals teaser.
2. **Pantry** — Default **Scan barcode** tab; confirm sheet after Open Food Facts hit; list with qty/expiry; Manual secondary; Advanced: receipt (collapsed).
3. **Recipes** — Grid/list with cost tier and struggle badge; detail with tips/boosters; URL import flow; deals strip when ingredients missing.
4. **Cook Now** — Step-through cook view optimized for phone / Echo Show browser; large type; pantry checkmarks.
5. **Coupons** — Clip / active / used; bright redeem surface.
6. **Learn to Cook** — Lesson path (placeholder curriculum cards); certificate preview (cloud sync — paid).

**Tech snapshot:** Next.js App Router, TypeScript, React, Tailwind, SQLite/Prisma, Vitest, html5-qrcode, tesseract.js (on-device OCR), Cheerio recipe parse, Open Food Facts API.

**Platform strategy:** Responsive web/PWA first (phones, tablets, Echo Show browser, desktop). Native iOS/Android later. **No separate Show app.**

---

## 5. Business model & pricing (proposed)

> All prices below are **proposed placeholders** for discussion — not launched SKUs or committed pricing.

### Open-core freemium

| Tier | Proposed price | Includes (directionally) |
|------|----------------|---------------------------|
| **Free / community** | $0 | Pantry, barcode intake, recipes, struggle meals, suggestions; optional self-host of **core**; basic Learn later |
| **Cloud subscription** | **~$4.99/mo (proposed)** | Manufacturer coupons & smarter deals, priority support, household sharing, synced Learn certificates |
| **Self-host supporter** | **~$1.99/mo (proposed)** | Lower price because customer brings infra; still pays for **coupon / deals network** access |

### Revenue logic (conceptual — not a forecast)

1. **Consumer subscriptions** — cloud convenience + deals + households + certificates.
2. **Network access for self-hosters** — keep open-core goodwill without giving away the deals graph for free.
3. **Manufacturer / brand side (GTM goal)** — portal for offers, attribution, and eventually standards-aligned coupons. **Do not treat as contracted revenue today.** Positioning: brands pay for reach to pantry-intent cooks at the moment of “I’m missing this ingredient.”

### What we are *not* claiming

- No ARR, MAU, or conversion rates in this document.
- No signed manufacturer contracts.
- No audited TAM/SAM — see §7 for illustrative category framing only.

---

## 6. Open-core / licensing stance

FridgeForge intends an **open-core** posture:

- **Core (free / self-hostable):** pantry, barcode intake, recipes, struggle meals, suggestions, and (later) basic learn-to-cook content that can run locally.
- **Cloud / network value:** manufacturer coupon network, smarter cross-recipe deals, sync, household sharing, certificate ledger, priority support — the parts that benefit from a shared service and commercial relationships.
- **Community:** public repo today ([trav1856/FridgeForge](https://github.com/trav1856/FridgeForge)); contributors and self-hosters welcome on core. Exact license text and CLA process: **TBD (founder to confirm).**
- **Rationale:** Trust and distribution with privacy-minded and budget users; clear upgrade path when coupons and households matter; avoids pretending a pure open-source deals marketplace funds itself.

Self-host supporters still pay a modest fee for network access — honesty about infra vs. network value.

---

## 7. Market opportunity

> **Illustrative only — not audited.** Use for conversation framing; replace with primary research before a formal raise.

### Category framing (public / directional)

FridgeForge sits at the intersection of:

- **Consumer meal planning & recipe apps** — large, crowded, often plan-first rather than pantry-first.
- **Grocery / coupon & retail media** — manufacturers and retailers spend heavily to move specific SKUs; intent at cook-time is underused by consumer apps.
- **Food waste & household budgeting** — cultural and policy attention on waste; pantry visibility is a practical lever.
- **Digital cooking education** — from free YouTube to premium courses; room for a structured beginner path tied to *what you own*.

### Illustrative sizing notes (assumptions — replace later)

| Layer | Framing | Caution |
|-------|---------|---------|
| **TAM (illustrative)** | Digitally engaged home cooks in English-speaking markets who use a smartphone for food decisions | Huge category umbrella; FridgeForge will not “own cooking” |
| **SAM (illustrative)** | Budget-conscious households seeking meal ideas from inventory + deals | Define with census + app-category comps in diligence |
| **SOM (illustrative)** | Early adopters: students, young families, frugal enthusiasts, self-hosters who try the MVP | Near-term SOM should track waitlist/installs once marketing starts — **not invented here** |

**Investor takeaway:** The wedge is narrow and concrete (pantry + struggle + deals). Expansion (Learn, households, local food) widens the aperture without requiring day-one marketplace liquidity.

---

## 8. Go-to-market

### Near-term (pre-manufacturer contracts)

1. **Ship a shareable PWA** — barcode intake and Struggle Meal mode as the demo hook.
2. **Content & community** — struggle-meal recipes, technique tips, “cook from 5 ingredients” challenges; warm food-brand voice without hype.
3. **Self-host / open-core** — GitHub visibility; Reddit/HN/self-host circles as credible early users (expect low ARPU; high product feedback).
4. **Campus / community orgs** — students and mutual-aid adjacent audiences who feel the struggle-meal problem acutely.
5. **SEO / recipe import** — URL import helps migration from scattered bookmarks.

### Manufacturer deals GTM (goal — not done)

- Pilot with **1–3 regional or mid-size brands** willing to place offers against pantry-intent moments.
- Prove attribution: “user cooking recipe X, missing SKU Y, redeemed offer Z.”
- Graduate from seed/demo coupons → brand portal → (eventually) standards-aware coupon flows.
- **Success metric ideas (to define):** offer view → clip → redeem rates; brand willingness to renew. *No fabricated rates in this draft.*

### Platform GTM note

Echo Show browser and kitchen-counter tablets are a natural surface for **Cook Now** — support via responsive web, not a separate Show APK.

---

## 9. Competition

| Competitor type | Examples | Their strength | FridgeForge wedge |
|-----------------|----------|----------------|-------------------|
| Self-host recipe managers | **Mealie** | Privacy, catalogs, enthusiasts | Niche; not struggle-meal or deals-first |
| Meal planners / recipe apps | Mealime, Paprika, Yummly | Content, plans, polish | Plan/catalog-first; weaker pantry-truth + budget dignity |
| Store / retailer apps | Chain apps | Coupons, loyalty | Siloed to one retailer; not cook-from-pantry |
| Budgeting apps | Various | Spend tracking | Rarely help you plate dinner tonight |
| Generic AI chat | ChatGPT et al. | Flexible ideas | No durable pantry graph, coupons, or household product |

**Positioning statement:** FridgeForge is the app that starts from **what’s in your fridge**, optimizes for **affordable food you’re proud of**, connects **deals at the moment of need**, and teaches you to cook — not another plan that assumes a full cart.

---

## 10. Roadmap

### Now (MVP / foundation)

- Pantry CRUD, barcode-first UPC, manual add
- Recipes + URL import, Struggle Meal mode, smart suggestions
- Coupons (demo/seed) + deals banner on missing ingredients
- Responsive web/PWA; SQLite local demo
- Receipt OCR kept experimental / Advanced only

### Next

- Multi-user auth & **households**
- Recipe **finished-dish images**
- Nav polish: Home, Pantry, Recipes, Cook Now, Coupons, Learn to Cook
- **Learn to Cook** v1 — beginner techniques (boil water → knife skills → foundational methods); lesson certificates; seek **credible chef endorsement (chef TBD; explicitly not Jamie Oliver)**
- **Per-recipe nutrition** — calories + macros (carbs, protein, fat), **estimated** from ingredients (always labeled as estimates, not lab assays); user-visible on recipe and Cook Now views; export (e.g. CSV / PDF summary)
- **User body profile** — height, weight, BMI, and progress tracking over time (privacy-minded; user-owned data)
- Cloud sync; proposed subscription packaging
- Manufacturer portal pilot (GTM)
- Replace SQLite demo assumptions with production multi-tenant data as needed

### Later

- Grower marketplace / **farm-to-table**
- **Withings** smart scale integration (weight sync into body profile; user said “Wise” — treated as Withings)
- Diet mode with **soft accountability** (careful privacy — no shaming product); may lean on nutrition estimates + body profile
- Native iOS / Android
- Deeper retail media / standards-aligned coupons
- Local-food logistics only if marketplace thesis clears supply/demand gates

---

## 11. Risks & mitigations

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| **Receipt OCR failure** | Users abandon intake if OCR is the “main” path | **Already decided:** barcode-first; OCR demoted to Advanced/experimental |
| **Open Food Facts gaps** | Some UPCs missing or wrong | Confirm UI + manual override; save barcode for next time; expand data sources later |
| **No manufacturer contracts yet** | Deals pillar looks empty without brands | Seed/demo coupons for UX; GTM pilots; free tier valuable without deals |
| **Crowded meal-app category** | Discovery & CAC | Sharp wedge (struggle + pantry); open-core distribution; content SEO |
| **Self-host ARPU pressure** | Community expects free forever | Clear open-core split; paid network access at lower ~$1.99 proposed |
| **Food / health claims** | Liability & trust | Stay technique- and pantry-focused; diet mode later, privacy-first, soft accountability only |
| **Single-founder bandwidth** | Execution risk | Technical partner/assistant; keep scope ruthless; public repo for leverage |
| **Nutrition estimate accuracy** | Users may treat estimates as medical fact | Label clearly as **estimates** from ingredients; no clinical claims; optional sources/disclaimers on export |
| **Body / health data sensitivity** | Height, weight, BMI, scale sync are sensitive | User-owned, opt-in; careful retention; Withings only Later with explicit consent |
| **Marketplace timing** | Farm-to-table is hard | Explicitly **Later**; do not block MVP on logistics |

---

## 12. The ask

### Seed amount

**$[ ________ ] seed — amount TBD**

Instrument / terms: *[SAFE / priced round TBD]* · Target close: *[Date TBD]*

### Sample use-of-funds outline (blanks for founder)

| Bucket | Approx. % | Amount | Notes |
|--------|-----------|--------|--------|
| Product engineering (auth, sync, households, Learn, image pipeline) | ___% | $______ | Core cloud + mobile web quality |
| Design / brand / recipe photography | ___% | $______ | Finished-dish images; prospectus screenshots |
| Manufacturer GTM / partnerships | ___% | $______ | Pilots, portal, BD travel |
| Infrastructure & security | ___% | $______ | Multi-tenant, backups, compliance basics |
| Content & community (struggle recipes, Learn curriculum) | ___% | $______ | Chef advisor stipend TBD |
| Runway / ops / legal | ___% | $______ | Entity, license counsel, insurance |
| **Total** | **100%** | **$______** | |

### 12–18 month milestones (directional — not commitments)

- [ ] Production auth + household sharing
- [ ] Paid cloud tier live at proposed price (or revised after validation)
- [ ] ≥1 manufacturer pilot with measurable redeem loop
- [ ] Learn to Cook v1 + first certificates
- [ ] Nutrition estimates on recipe/cook + CSV/PDF export
- [ ] Body profile (height/weight/BMI/progress) — opt-in
- [ ] Screenshot-complete investor/consumer deck
- [ ] Clear license + open-core boundary published

---

## 13. Appendix

### A. Glossary

| Term | Meaning |
|------|---------|
| **Struggle meal** | A deliberately inexpensive meal built from staples, elevated with technique and cheap flavor boosters |
| **Barcode-first** | Primary pantry intake via UPC/EAN scan or entry + product database lookup |
| **Open Food Facts** | Free collaborative product database used for barcode lookup |
| **Open-core** | Core product self-hostable/free; valuable network/cloud features commercial |
| **PWA** | Progressive Web App — installable web experience without native store dependency |
| **Cook Now** | Guided cook surface optimized for kitchen devices (phone / tablet / Echo Show browser) |
| **Deals banner** | UI when a recipe’s missing ingredients match active coupons |
| **Learn certificates** | Proof of completed beginner lessons; sync intended as a paid/cloud feature |
| **Nutrition estimates** | Per-recipe calories and macros derived from ingredients — labeled estimates, not laboratory analysis |
| **Body profile** | User height, weight, BMI, and progress history for optional personal tracking |
| **Withings** | Third-party smart scale platform for later weight sync (referenced by user as “Wise”) |

### B. Contact placeholders

| | |
|---|---|
| **Company** | FridgeForge |
| **Founder** | *[Name TBD]* |
| **Email** | *[hello@… TBD]* |
| **Web** | *[URL TBD]* |
| **GitHub** | https://github.com/trav1856/FridgeForge |
| **Calendly / booking** | *[TBD]* |

### C. Team placeholder

*[Founder to fill — short bios, prior work, why this problem. Technical partner/assistant noted; no invented credentials.]*

### D. Document control

| Version | Date | Notes |
|---------|------|--------|
| 0.1 draft | Sep 2026 | Initial prospectus from MVP facts; no fake traction |
| 0.2 draft | Sep 2026 | Added nutrition estimates, body profile (Next); Withings (Later) |

---

*FridgeForge — cook great food from what you already have, especially on a budget.*

*This document is a confidential draft for discussion. Proposed prices and market figures are illustrative unless replaced with audited data. Manufacturer deals are a GTM goal, not existing contracts.*
