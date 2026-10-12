-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "profilePublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "socialFacebook" TEXT,
ADD COLUMN     "socialX" TEXT;

-- CreateTable
CREATE TABLE "ProfilePin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfilePin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfilePin_recipeId_idx" ON "ProfilePin"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePin_userId_kind_position_key" ON "ProfilePin"("userId", "kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePin_userId_kind_recipeId_key" ON "ProfilePin"("userId", "kind", "recipeId");

-- AddForeignKey
ALTER TABLE "ProfilePin" ADD CONSTRAINT "ProfilePin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePin" ADD CONSTRAINT "ProfilePin_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

