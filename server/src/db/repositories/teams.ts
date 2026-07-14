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

// ---- team invites (FR-014 roster, email-based) ----

/** Teams a user belongs to, with their role in each (for the roster selector). */
export async function listTeamsForUser(db: PrismaClient, userId: string) {
  return db.team.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      captainId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
}

/** Create or reactivate (re-invite after cancel) a PENDING invite for an email. */
export async function createInvite(
  db: PrismaClient,
  args: { teamId: string; email: string; invitedBy: string },
) {
  return db.teamInvite.upsert({
    where: { teamId_email: { teamId: args.teamId, email: args.email } },
    create: { teamId: args.teamId, email: args.email, invitedBy: args.invitedBy },
    update: { status: "PENDING", invitedBy: args.invitedBy },
  });
}

export async function listInvitesForTeam(db: PrismaClient, teamId: string) {
  return db.teamInvite.findMany({ where: { teamId }, orderBy: { createdAt: "desc" } });
}

export async function findInviteByToken(db: PrismaClient, token: string) {
  return db.teamInvite.findUnique({ where: { token } });
}

export async function findPendingInvitesByEmail(db: PrismaClient, email: string) {
  return db.teamInvite.findMany({
    where: { email: { equals: email, mode: "insensitive" }, status: "PENDING" },
    include: { team: { select: { id: true, name: true } } },
  });
}

export async function acceptInvite(db: PrismaClient, token: string) {
  return db.teamInvite.update({ where: { token }, data: { status: "ACCEPTED" } });
}

export async function cancelInvite(db: PrismaClient, id: string) {
  return db.teamInvite.update({ where: { id }, data: { status: "CANCELLED" } });
}

/** Drop any PENDING invite for an email once that user is a direct member. */
export async function cancelInvitesForEmail(
  db: PrismaClient,
  teamId: string,
  email: string,
): Promise<void> {
  await db.teamInvite.updateMany({
    where: { teamId, email: { equals: email, mode: "insensitive" }, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
}
