-- CreateTable: Struggle Mode tips / kids-meal cards (non-destructive)
CREATE TABLE IF NOT EXISTS "StruggleResource" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "linksJson" TEXT NOT NULL DEFAULT '[]',
    "whenLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StruggleResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StruggleResource_slug_key" ON "StruggleResource"("slug");
CREATE INDEX IF NOT EXISTS "StruggleResource_kind_sortOrder_idx" ON "StruggleResource"("kind", "sortOrder");
CREATE INDEX IF NOT EXISTS "StruggleResource_published_idx" ON "StruggleResource"("published");
CREATE INDEX IF NOT EXISTS "StruggleResource_kind_published_sortOrder_idx" ON "StruggleResource"("kind", "published", "sortOrder");
