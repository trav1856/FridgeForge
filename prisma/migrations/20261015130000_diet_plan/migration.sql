-- CreateTable
CREATE TABLE "RecipeNutritionSnapshot" (
    "recipeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugars" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saturatedFat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sodium" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perServingJson" TEXT NOT NULL,
    "matchedCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "coveragePct" INTEGER NOT NULL,
    "trusted" BOOLEAN NOT NULL DEFAULT false,
    "reasons" TEXT NOT NULL DEFAULT '[]',
    "assumptions" TEXT NOT NULL DEFAULT '[]',
    "unmatched" TEXT NOT NULL DEFAULT '[]',
    "servingsSuspect" BOOLEAN NOT NULL DEFAULT false,
    "servingsNote" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeNutritionSnapshot_pkey" PRIMARY KEY ("recipeId")
);

-- CreateTable
CREATE TABLE "UserDietSettings" (
    "userId" TEXT NOT NULL,
    "dietType" TEXT NOT NULL DEFAULT 'balanced',
    "kcalTarget" INTEGER NOT NULL,
    "mealsPerDay" INTEGER NOT NULL DEFAULT 3,
    "proteinPct" INTEGER,
    "carbsPct" INTEGER,
    "fatPct" INTEGER,
    "tolerancePct" INTEGER NOT NULL DEFAULT 10,
    "ageBand" TEXT NOT NULL,
    "disclaimerAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDietSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DietMenuPlan" (
    "userId" TEXT NOT NULL,
    "planJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DietMenuPlan_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "RecipeNutritionSnapshot_trusted_idx" ON "RecipeNutritionSnapshot"("trusted");

-- AddForeignKey
ALTER TABLE "RecipeNutritionSnapshot" ADD CONSTRAINT "RecipeNutritionSnapshot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDietSettings" ADD CONSTRAINT "UserDietSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietMenuPlan" ADD CONSTRAINT "DietMenuPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

