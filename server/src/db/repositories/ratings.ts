import { PrismaClient } from "@prisma/client";
import type { Rating, RatingSubjectType } from "@prisma/client";

export async function getTeamRating(db: PrismaClient, teamId: string): Promise<Rating | null> {
  return db.rating.findUnique({ where: { teamId } });
}

export async function getUserRating(db: PrismaClient, userId: string): Promise<Rating | null> {
  return db.rating.findUnique({ where: { userId } });
}

export async function upsertRating(
  db: PrismaClient,
  args: { subjectType: RatingSubjectType; teamId?: string; userId?: string },
): Promise<Rating> {
  const where = args.teamId ? { teamId: args.teamId } : { userId: args.userId ?? "" };
  return db.rating.upsert({
    where,
    create: { subjectType: args.subjectType, teamId: args.teamId, userId: args.userId },
    update: {},
  });
}
