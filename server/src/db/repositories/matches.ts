import { PrismaClient } from "@prisma/client";
import type { Match, Prisma } from "@prisma/client";

export async function createMatch(
  db: PrismaClient,
  data: Prisma.MatchCreateInput,
): Promise<Match> {
  return db.match.create({ data });
}

export async function findMatchById(db: PrismaClient, id: string): Promise<Match | null> {
  return db.match.findUnique({ where: { id } });
}
