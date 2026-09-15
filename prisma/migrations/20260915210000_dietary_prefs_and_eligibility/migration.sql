-- Dietary prefs on User + recipe eligibility flags (non-destructive ADD COLUMN)
ALTER TABLE "User" ADD COLUMN "isJewish" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "isObservant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferKosher" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferHalal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Recipe" ADD COLUMN "kosherEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "halalEligible" BOOLEAN NOT NULL DEFAULT false;
