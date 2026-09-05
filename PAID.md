# FridgeForge Paid track (in progress)

**Status:** scaffold · 1.1.0-alpha
**Community Edition** remains Apache-2.0 and fully usable without login.

## What landed in this alpha

- Prisma models: User, Session, Household, HouseholdMember
- Optional householdId on PantryItem, Recipe, Coupon (null = guest / CE legacy)
- Cookie session auth (ff_session) via /api/auth/*
- Household create / join / list APIs
- Account page (/account) for sign-up, sign-in, households, invite codes
- Edition stub: canAccessLiveCoupons(user) — Pro only; demo coupons always visible
- Soft Coupons upsell banner for non-Pro

## Try it

```bash
npm run db:push
npm run db:seed
npm run dev
```

1. Open http://localhost:3000/account
2. Sign up, or use seed Pro: pro@fridgeforge.local / prodemo
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
