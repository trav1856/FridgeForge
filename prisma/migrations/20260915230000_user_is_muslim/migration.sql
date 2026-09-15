-- Muslim identity flag (soft prefer + show Halal); preferHalal remains hard-filter
ALTER TABLE "User" ADD COLUMN "isMuslim" BOOLEAN NOT NULL DEFAULT false;
