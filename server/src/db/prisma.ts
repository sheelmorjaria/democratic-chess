import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getPrisma(databaseUrl?: string): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient(
      databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
    );
  }
  return prisma;
}

/** Test-only: drop the cached client so tests can supply a custom URL. */
export function __resetPrismaForTests(): void {
  prisma = null;
}
