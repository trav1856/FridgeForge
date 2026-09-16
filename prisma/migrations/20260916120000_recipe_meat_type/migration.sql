-- Optional meat subtype when foodCategories includes meat (beef|pork|chicken|other).
-- Fish/shrimp stay under seafood, not meat.
ALTER TABLE "Recipe" ADD COLUMN "meatType" TEXT;
CREATE INDEX "Recipe_meatType_idx" ON "Recipe"("meatType");
