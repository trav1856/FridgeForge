# Admin panel & recipe reviews

## Roles

- `User.role`: `user` (default) or `admin`
- `User.disabled`: soft-disable (blocked from sign-in; sessions cleared)

Bootstrap admins:

1. Built-in owner email(s) in `src/lib/admin.ts` (`DEFAULT_ADMIN_EMAILS`)
2. Env `FF_ADMIN_EMAILS` — comma-separated list

`promoteAdminEmails()` runs from non-destructive seed and when opening `/admin`.

## Admin UI (`/admin`)

Gated by `user.role === "admin"` (layout redirect + API 403).

- Dashboard — basic counts
- Recipes — search/filter by cuisine/course/food/origin, edit taxonomy, cycle visibility (Global → Household → Shared), struggle flag, delete
- Users — set role admin/user, enable/disable

Nav shows **Admin** only when the signed-in user is an admin.

## Recipe ratings (not admin-gated)

Any **signed-in** user can post one rating+comment per recipe (`RecipeReview`: stars 1–5, body ≤180). Guests can read; must sign in to post. Share links: X/Twitter intent + Facebook sharer on the recipe detail reviews card.

## Next.js corner indicator

`next.config.ts` sets `devIndicators: false` so the bottom-left Next “N” badge does not show for anyone (Next cannot role-gate it cleanly). Production `next start` also has no indicator.
