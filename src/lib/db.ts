import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function clientIsCurrent(client: PrismaClient): boolean {
  const c = client as {
    recipeCookSession?: unknown;
    recipeCookStat?: unknown;
  };
  return (
    typeof c.recipeCookSession !== "undefined" &&
    typeof c.recipeCookStat !== "undefined"
  );
}

function getPrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && clientIsCurrent(existing)) {
    return existing;
  }
  try {
    existing?.$disconnect().catch(() => {});
  } catch {
    /* ignore */
  }
  const client = createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getPrisma();
