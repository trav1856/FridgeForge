# Item photos, barcode photos and shared product records

## Item photo
Manual add (and Edit item) take a photo (`capture=environment`) or upload one.
Uploads go to `/api/pantry/[id]/image` and are re-encoded by `reencodePhoto`
(sharp: verify image, auto-orient, ≤1200px, WebP, no EXIF/GPS). Files live in
`public/pantry-images/user/` and are served by the `/pantry-images/user/[file]`
route so new photos show without a restart. Replaced photos and deleted items
remove their file.

## Barcode photo
`BarcodePhotoField` decodes a still photo with the browser `BarcodeDetector`
when present, else `html5-qrcode` `scanFile` (the library the live scanner
already uses). The user confirms or types the number. `src/lib/barcode.ts`
validates UPC-A / EAN-13 / EAN-8 check digits; EAN-13 with a leading 0 is
stored as its UPC-A.

## Shared product records
No barcode product table existed before (only `PantryItem.barcode` and live
Open Food Facts calls), so two new tables were added:

- `SharedProduct` (unique barcode): name, size, unit, category, imageUrl.
  `createdByUserId` / `createdByHouseholdId` are internal (admin only).
- `HouseholdProductOverride` (unique householdId+barcode): what one household
  saved when it differs from the shared record.

Rules (`src/lib/shared-products.ts`):
- After a signed-in save with a valid barcode the client calls
  `POST /api/products/contribute {itemId}`. The server reads the household's
  own pantry item. No shared record → create one (first save wins; photo is
  copied to `public/product-images/shared/`). Otherwise a differing save
  upserts that household's override (photo copied to `.../household/`).
- Scan prefill (`GET /api/barcode/lookup`): household override → shared record
  → Open Food Facts. Read-only for everyone; guests read shared records only.
- Public responses go through `toPublicProduct` (barcode, name, size, unit,
  category, imageUrl, source).
- Rate limit: 20 shared records per user per hour, 100 per day.

## Admin
`/admin/products`: search, edit, replace/remove photo, delete. Every change is
written to `AdminAuditLog` (`product.*`). Removing a shared photo points pantry
items and overrides that used it back to their default picture.

## Runtime image routes
`next start` only serves `public/` files that existed at startup. Routes at the
same URLs serve later files: `/recipe-images/user/[file]`,
`/recipe-images/import/[file]`, `/pantry-images/user/[file]`,
`/product-images/{shared,household}/[file]`.
