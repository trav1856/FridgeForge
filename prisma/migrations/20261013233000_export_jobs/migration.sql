-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "manifestSha256" TEXT,
    "error" TEXT,
    "linkTokenHash" TEXT,
    "linkExpiresAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExportJob_linkTokenHash_key" ON "ExportJob"("linkTokenHash");

-- CreateIndex
CREATE INDEX "ExportJob_createdById_createdAt_idx" ON "ExportJob"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");

