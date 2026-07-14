import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../../auth/middleware.js";
import {
  acceptInvite,
  addMember,
  cancelInvite,
  cancelInvitesForEmail,
  createInvite,
  createTeamWithCaptain,
  findInviteByToken,
  findTeamById,
  listInvitesForTeam,
  listTeamsForUser,
  removeMember,
} from "../../db/repositories/teams.js";
import { findUserByEmail, findUserById } from "../../db/repositories/users.js";
import { upsertRating } from "../../db/repositories/ratings.js";

const createTeamSchema = z.object({ name: z.string().min(3).max(48) });
const inviteEmailSchema = z.object({ email: z.string().email().max(254) });

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

function inviteUrl(token: string): string {
  return `${CLIENT_ORIGIN}/join?token=${token}`;
}

export function createTeamsRouter(db: PrismaClient): Router {
  const router = Router();

  router.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { name } = createTeamSchema.parse(req.body);
      const team = await createTeamWithCaptain(db, { name, captainId: req.userId ?? "" });
      await upsertRating(db, { subjectType: "TEAM", teamId: team.id });
      res.status(201).json(team);
    } catch (error) {
      next(error);
    }
  });

  // Teams the caller belongs to (drives the roster selector — no id pasting).
  // Registered before `/:id` so "mine" isn't captured as an id.
  router.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const rows = await listTeamsForUser(db, req.userId ?? "");
      res.json(
        rows.map((t) => ({
          id: t.id,
          name: t.name,
          captainId: t.captainId,
          role: t.members[0]?.role ?? "MEMBER",
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  // Accept a shareable invite link while logged in (email must match the invite).
  router.post("/invites/:token/accept", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const invite = await findInviteByToken(db, req.params.token ?? "");
      if (!invite || invite.status !== "PENDING") {
        res.status(404).json({ code: "not_found", message: "invite not found or already used" });
        return;
      }
      const user = await findUserById(db, req.userId ?? "");
      if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
        res.status(403).json({ code: "email_mismatch", message: "this invite is for a different email address" });
        return;
      }
      await addMember(db, { teamId: invite.teamId, userId: user.id });
      await acceptInvite(db, invite.token);
      res.json({ status: "accepted", teamId: invite.teamId });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", requireAuth, async (req, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      res.json(team);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/members", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      if (team.captainId !== req.userId) {
        res.status(403).json({ code: "forbidden", message: "only the captain can manage the roster" });
        return;
      }
      const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
      await addMember(db, { teamId: team.id, userId });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id/members/:userId", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      if (team.captainId !== req.userId) {
        res.status(403).json({ code: "forbidden", message: "only the captain can manage the roster" });
        return;
      }
      await removeMember(db, team.id, req.params.userId ?? "");
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // ---- email invites (captain) ----

  router.post("/:id/invites", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      if (team.captainId !== req.userId) {
        res.status(403).json({ code: "forbidden", message: "only the captain can manage the roster" });
        return;
      }
      const { email } = inviteEmailSchema.parse(req.body);

      // Already a member?
      const existing = await findUserByEmail(db, email);
      if (existing && team.members.some((m) => m.userId === existing.id)) {
        res.json({ status: "already_member", email, username: existing.username });
        return;
      }
      if (existing) {
        // Registered user → add directly.
        await addMember(db, { teamId: team.id, userId: existing.id });
        await cancelInvitesForEmail(db, team.id, email);
        res.json({ status: "added", email, username: existing.username });
        return;
      }

      // Not registered → store a PENDING invite + return a shareable link.
      const invite = await createInvite(db, { teamId: team.id, email, invitedBy: req.userId ?? "" });
      res.json({ status: "invited", email, inviteUrl: inviteUrl(invite.token) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/invites", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      if (team.captainId !== req.userId) {
        res.status(403).json({ code: "forbidden", message: "only the captain can manage the roster" });
        return;
      }
      const invites = await listInvitesForTeam(db, team.id);
      res.json({
        invites: invites.map((i) => ({
          id: i.id,
          email: i.email,
          status: i.status,
          createdAt: i.createdAt,
          inviteUrl: i.status === "PENDING" ? inviteUrl(i.token) : undefined,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id/invites/:inviteId", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const team = await findTeamById(db, req.params.id ?? "");
      if (!team) {
        res.status(404).json({ code: "not_found", message: "team not found" });
        return;
      }
      if (team.captainId !== req.userId) {
        res.status(403).json({ code: "forbidden", message: "only the captain can manage the roster" });
        return;
      }
      await cancelInvite(db, req.params.inviteId ?? "");
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
