-- Plant-based dietary prefs on User + recipe eligibility + adapt notes
ALTER TABLE "User" ADD COLUMN "preferVegetarian" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferPescatarian" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferVegan" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Recipe" ADD COLUMN "vegetarianEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "pescatarianEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "veganEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "veganAdaptNote" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "vegetarianAdaptNote" TEXT;
