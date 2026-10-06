# FridgeForge Paid track (in progress)

**Status:** scaffold · 1.1.0-alpha
Guest mode (no login) remains fully usable; paid features layer on top.

## What landed in this alpha

- Prisma models: User, Session, Household, HouseholdMember
- Optional householdId on PantryItem, Recipe, Coupon (null = guest / legacy)
- Cookie session auth (ff_session) via /api/auth/*
- Household create / join / list APIs
- Account page (/account) for sign-up, sign-in, households, invite codes
- Edition stub: canAccessLiveCoupons(user) — Premium (pro) only; demo coupons always visible
- Soft Coupons upsell banner for non-Premium

## Try it

```bash
npm run db:push
npm run db:seed
npm run dev
```

1. Open http://localhost:3000/account
2. Sign up, or use seed Premium: pro@fridgeforge.local / prodemo
3. Create a household (owner + invite code) or join with a code
4. Pantry/recipes GET+POST scope to first household when signed in
5. Sign out — guest path uses householdId null again

## Not yet

- Live manufacturer deals network
- Billing / Stripe
- Household switcher UI (first membership is active)
- Migrating guest rows into a household

## Later (not this scaffold)

- Restaurant daily sales submission → trending dishes + grocery planning for kitchens
- Supplier demand board (e.g. who needs okra/potatoes) connecting suppliers ↔ restaurants ↔ individuals

## Recipe sharing (planned)

- Visibility: `private` (default) | `household` | `public` | `invite` (selected households / share link)
- Public recipes can be free to clone into another household’s book
- Cross-household sharing is a cloud/network feature (Premium / Free+ads), not required for guest use
- Monetization lean: cloud Free may use light ads or caps; Premium = no ads + network (live coupons, sharing, later F&B pulse)

## Pricing (working — 2026-09-05)

| Tier | Price | What you get |
|------|-------|----------------|
| **Self-host Network** | **$1.99/mo** | Self-hosted install + join the network (shared recipes, live deals, later F&B pulse) |
| **Cloud Free** | Free | Full hosted app + light **manufacturer banner ads** (non-obstructive) |
| **Cloud Premium** | **$4.99/mo** | No ads + Premium perks (live coupons, sharing network, priority support) |

Ads: major food manufacturers / CPG — not independent growers (growers belong in marketplace listings). Never disguise an ad as a coupon or deal.
