-- Macro / lifestyle dietary prefs on User + recipe eligibility flags
ALTER TABLE "User" ADD COLUMN "preferCarnivore" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferAtkins" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferLowCarb" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferLowSugar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "preferLowSodium" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Recipe" ADD COLUMN "carnivoreEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "atkinsEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "lowCarbEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "lowSugarEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recipe" ADD COLUMN "lowSodiumEligible" BOOLEAN NOT NULL DEFAULT false;
