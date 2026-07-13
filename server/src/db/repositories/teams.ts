import { PrismaClient } from "@prisma/client";
import type { Prisma, Team } from "@prisma/client";

type TeamWithMembers = Prisma.TeamGetPayload<{
  include: {
    members: { include: { user: { select: { id: true; username: true } } } };
  };
}>;

export async function createTeamWithCaptain(
  db: PrismaClient,
  args: { name: string; captainId: string },
): Promise<Team> {
  return db.team.create({
    data: {
      name: args.name,
      captainId: args.captainId,
      members: { create: { userId: args.captainId, role: "CAPTAIN" } },
    },
  });
}

export async function findTeamById(
  db: PrismaClient,
  id: string,
): Promise<TeamWithMembers | null> {
  return db.team.findUnique({
    where: { id },
    include: { members: { include: { user: { select: { id: true, username: true } } } } },
  });
}

export async function addMember(
  db: PrismaClient,
  args: { teamId: string; userId: string; role?: "CAPTAIN" | "MEMBER" },
): Promise<void> {
  await db.teamMembership.upsert({
    where: { teamId_userId: { teamId: args.teamId, userId: args.userId } },
    create: { teamId: args.teamId, userId: args.userId, role: args.role ?? "MEMBER" },
    update: {},
  });
}

export async function removeMember(
  db: PrismaClient,
  teamId: string,
  userId: string,
): Promise<void> {
  await db.teamMembership.delete({ where: { teamId_userId: { teamId, userId } } });
}
