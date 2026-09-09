import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  // After `prisma generate`, a cached client can miss new models (e.g. recipeCookSession).
  if (
    existing &&
    typeof (existing as { recipeCookSession?: unknown }).recipeCookSession !==
      "undefined"
  ) {
    return existing;
  }
  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrisma();
