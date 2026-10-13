-- CreateTable
CREATE TABLE "SharedProduct" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "createdByUserId" TEXT,
    "createdByHouseholdId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdProductOverride" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "unit" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdProductOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedProduct_barcode_key" ON "SharedProduct"("barcode");

-- CreateIndex
CREATE INDEX "SharedProduct_createdByUserId_createdAt_idx" ON "SharedProduct"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedProduct_name_idx" ON "SharedProduct"("name");

-- CreateIndex
CREATE INDEX "HouseholdProductOverride_barcode_idx" ON "HouseholdProductOverride"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdProductOverride_householdId_barcode_key" ON "HouseholdProductOverride"("householdId", "barcode");

-- AddForeignKey
ALTER TABLE "HouseholdProductOverride" ADD CONSTRAINT "HouseholdProductOverride_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

