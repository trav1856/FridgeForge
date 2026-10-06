-- Retire the shared (null-household) pool.
-- Guests now use a browser-only demo pantry, a local shopping list and static
-- sample coupons, so null-scope rows are no longer read or written by the app.
-- Approved one-time deletion (a pg_dump backup is taken before deploy).

DELETE FROM "PantryItem" WHERE "householdId" IS NULL;
DELETE FROM "CustomPantryStaple" WHERE "householdId" IS NULL;
DELETE FROM "Coupon" WHERE "householdId" IS NULL;
DELETE FROM "ShoppingListItem" WHERE "householdId" IS NULL AND "userId" IS NULL;

-- A deleted household must not drop its rows into the null scope:
-- household-owned pantry items, custom staples and coupons now cascade.
ALTER TABLE "PantryItem" DROP CONSTRAINT "PantryItem_householdId_fkey";
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomPantryStaple" DROP CONSTRAINT "CustomPantryStaple_householdId_fkey";
ALTER TABLE "CustomPantryStaple" ADD CONSTRAINT "CustomPantryStaple_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_householdId_fkey";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
