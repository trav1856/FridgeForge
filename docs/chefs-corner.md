# Chef's Corner + The Kitchen Table

## Roles
- **Chef account** (one flag, `User.isChef`): replaces a separate "Contributor" role.
  Only admins set it, on `/admin/users/[id]` (audit `user.chef`). Flagging creates
  the chef's own `FeaturedProfile`, credits their public recipes (Featured Chef
  badge) and lets them write Kitchen Table posts from `/studio`.
  Unflagging hides the profile (content kept), removes the badge and unpins it.
- **Can publish directly** (`User.chefCanPublish`, default on, audit
  `user.chef_publish`): off = chef posts go to the review queue (`/admin/posts`).
  Without it a chef can't edit or delete a live post.
- **Admins** manage everything; they can also add chefs with no account
  (`/admin/chefs`) and credit public recipes to them.
- Guests read only. Every write is same-origin + signed-in.

## Profiles
`FeaturedProfile.profileType` is `"chef"` today. It is a generic featured-profile
table so other kinds (e.g. growers/producers) can be added later without a new
model. No marketplace features.

## Posts
- Status: `draft` → (`review`) → `scheduled` | `published`. `publishedAt` holds
  the go-live time; a post is live when status is scheduled/published and
  `publishedAt <= now` (no cron needed).
- Body HTML is sanitized on save and on render (`lib/content/sanitize.ts`,
  allowlist via cheerio). Images: only `/content-images/*.webp`. Video: only
  YouTube, rebuilt as a youtube-nocookie iframe. External links get
  `rel="noopener nofollow ugc"`.
- Photos (chef, cover, inline) are re-encoded with sharp to WebP (EXIF/GPS
  stripped) into `public/content-images/`, served by the route
  `/content-images/[file]` immediately after upload.
- Audit: `post.publish` (incl. scheduled time), `post.unpublish`, `post.reject`,
  `profile.feature`, `pin.add`, `pin.remove`.

## Home strip
Admin pins (`/admin/featured`) for chefs or posts. Hidden when nothing visible is pinned.

## Export
Full: new tables are in the dump and CSV/JSON; `content-images/` in uploads.
Content-only: visible profiles (userId nulled), live posts (author nulled), their
pins; referenced images. Single user: their profile and their posts.
