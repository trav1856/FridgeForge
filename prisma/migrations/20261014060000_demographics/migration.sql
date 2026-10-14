-- CreateTable
CREATE TABLE "UserDemographics" (
    "userId" TEXT NOT NULL,
    "sex" TEXT,
    "ethnicities" TEXT NOT NULL DEFAULT '[]',
    "originCountries" TEXT NOT NULL DEFAULT '[]',
    "researchConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "age16ConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDemographics_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RecipeView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "cuisine" TEXT,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 1,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDemographics_researchConsent_idx" ON "UserDemographics"("researchConsent");

-- CreateIndex
CREATE INDEX "RecipeView_cuisine_idx" ON "RecipeView"("cuisine");

-- CreateIndex
CREATE INDEX "RecipeView_userId_idx" ON "RecipeView"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeView_userId_recipeId_day_key" ON "RecipeView"("userId", "recipeId", "day");

-- AddForeignKey
ALTER TABLE "UserDemographics" ADD CONSTRAINT "UserDemographics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeView" ADD CONSTRAINT "RecipeView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeView" ADD CONSTRAINT "RecipeView_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

