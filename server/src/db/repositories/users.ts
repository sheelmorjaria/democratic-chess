import { PrismaClient } from "@prisma/client";
import type { User } from "@prisma/client";

export async function createUser(
  db: PrismaClient,
  args: { username: string; email: string; passwordHash: string },
): Promise<User> {
  return db.user.create({ data: args });
}

export async function findUserByEmail(db: PrismaClient, email: string): Promise<User | null> {
  return db.user.findUnique({ where: { email } });
}

export async function findUserById(db: PrismaClient, id: string): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

export async function findUserByUsername(db: PrismaClient, username: string): Promise<User | null> {
  return db.user.findUnique({ where: { username } });
}
