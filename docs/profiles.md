# Cook profiles (Stage 1)

Stage 1 covers profile fields, photos, the public page and pins. Follows, comments, reports and blocks come in later stages, and none of their UI exists yet.

## Routes
- `/u/[handle]`: the public profile. On desktop it has a banner, an avatar overlapping the banner, a sidebar (About, badges) and a main column (My top 3, Favorites from other cooks, Recipes). On mobile it's a single column.
- `/account/profile`: edit profile (owner only). `/account` has an Edit profile button.
- API: `GET/PATCH /api/profile`, `GET /api/profile/handle?h=`, `PUT /api/profile/pins`, `POST/DELETE /api/profile/images/{avatar|banner}`, `GET /api/profiles/[handle]` (public JSON).
  Every write acts on the signed-in user only (no user id in the route or body). Guests get 401.

## Fields
- Display name = `User.name`. **Handle = `User.profileSlug`**. It was reused rather than replaced because it's already unique, already in every `/u/...` URL, the admin user page and the kitchen strip, and every account already has one. Editable: 3–30 characters, lowercase letters, numbers and hyphens, reserved words blocked. Changing your handle changes your URL, and the old URL stops working.
- `bio` (≤200), `socialX` / `socialFacebook` (normalized to `https://x.com/…` / `https://www.facebook.com/…`; rendered with `rel="noopener noreferrer nofollow"`), `profilePublic` (Private shows others only "This profile is private" and the @handle).
- **Never public:** email, allergies, diet/food prefs, household, pantry, plan and role. Public payloads go through `toPublicProfileFields` and `PROFILE_USER_SELECT` in `src/lib/profile.ts`, and `__tests__/profile-stage1.test.ts` checks that.

## Photos
Uploads go to `public/profile-images/u/` (same storage approach as user recipe photos; git-ignored). They're served by `src/app/profile-images/u/[file]/route.ts`, because `next start` only serves `public/` files that existed when it started. Each upload is decoded with sharp (JPEG/PNG/WebP only, by content, not by the claimed MIME type; ≤8MB; ≤50MP), auto-oriented, then cropped on the server from zoom/position values. Output is WebP: avatar 400×400, banner 1500×500. No EXIF/GPS/XMP/ICC metadata is kept. The old file is deleted when replaced or removed, and on admin account delete.

## Pins
`ProfilePin` (kind `own` | `favorite`, position 1–3). "My top 3" must be your own recipes. "Favorites from other cooks" must be recipes you've favorited that someone else wrote; the author is shown, and linked only if their profile is public. Visitors only see pins they're allowed to see (`canViewRecipe`), so household-only recipes stay hidden from outsiders.

## Age gate
Signup asks for a date of birth and rejects anyone under 13 (`FF_MIN_AGE` can raise this, not lower it). Only `ageConfirmedAt` is stored, never the date. An under-age attempt sets a 24h `ff_age_block` cookie. Accounts created before this change confirm their date of birth once on Edit profile before they can save profile changes, upload photos or set pins.
