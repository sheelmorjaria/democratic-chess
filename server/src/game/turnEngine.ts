import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import { moveKey as makeMoveKey } from "@democratic-chess/types";
import {
  addPresence,
  addProposal,
  armTurnTimer,
  castVote,
  clearTurn,
  getProposals,
  getTallies,
  removePresence,
  type ProposalRecord,
  type Tally,
} from "../voting/ephemeral.js";
import { ChessEngine } from "./engine.js";
import { executeMove } from "./executeMove.js";
import { colorRoom, joinMatchRooms, matchRoom, type AppSocket } from "../realtime/io.js";
import { validateProposeMove, validateSendChatMessage, validateVoteMove } from "../realtime/validate.js";

/**
 * US1 turn resolution: highest-voted proposal wins; ties broken by the earliest
 * proposed move. `empty` only when the ballot has no proposals.
 * (Captain double-weight tie-break is layered on in US3 / T034.)
 */
export interface TurnResolution {
  moveKey: string | null;
  reason: "leading" | "empty";
}

export function resolveLeading(
  proposals: Record<string, ProposalRecord>,
  tallies: Tally[],
): TurnResolution {
  const keys = Object.keys(proposals);
  if (keys.length === 0) return { moveKey: null, reason: "empty" };

  const counts = new Map<string, number>();
  for (const tally of tallies) counts.set(tally.moveKey, tally.count);

  let bestKey = keys[0] as string;
  let bestCount = counts.get(bestKey) ?? 0;

  for (const key of keys) {
    const count = counts.get(key) ?? 0;
    const isHigher = count > bestCount;
    const isTieButEarlier =
      count === bestCount && proposedAt(proposals, key) < proposedAt(proposals, bestKey);
    if (isHigher || isTieButEarlier) {
      bestKey = key;
      bestCount = count;
    }
  }
  return { moveKey: bestKey, reason: "leading" };
}

function proposedAt(proposals: Record<string, ProposalRecord>, key: string): number {
  return proposals[key]?.proposedAt ?? 0;
}

export interface TurnEngineDeps {
  db: PrismaClient;
  redis: Redis;
  io: Server;
}

/**
 * Drives a match's realtime loop: opens a turn, arms the Redis turn-timer key,
 * schedules resolution on the server (single-node MVP; survives via Redis key on
 * reconnect), and serves the propose/vote/execute socket handlers.
 */
export class TurnEngine {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly deps: TurnEngineDeps) {}

  async startMatch(matchId: string): Promise<void> {
    await this.openTurn(matchId);
  }

  private async openTurn(matchId: string): Promise<void> {
    const match = await this.deps.db.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== "ACTIVE") return;
    const color = match.turn === "WHITE" ? "white" : "black";
    const deadlineAt = new Date(Date.now() + match.moveWindowSec * 1000);
    this.deps.io
      .to(matchRoom(matchId))
      .emit("turn_start", { color, turnNumber: match.turnNumber, deadlineAt: deadlineAt.toISOString() });
    await armTurnTimer(this.deps.redis, matchId, match.turnNumber, match.moveWindowSec);
    this.scheduleResolution(matchId, match.moveWindowSec * 1000);
  }

  private scheduleResolution(matchId: string, delayMs: number): void {
    this.clearTimer(matchId);
    const handle = setTimeout(() => {
      this.resolveTurn(matchId).catch((error) => console.error("[turnEngine] resolve error", error));
    }, delayMs);
    this.timers.set(matchId, handle);
  }

  private clearTimer(matchId: string): void {
    const handle = this.timers.get(matchId);
    if (handle) {
      clearTimeout(handle);
      this.timers.delete(matchId);
    }
  }

  /** Clears all armed turn timers (call on shutdown / test teardown). */
  dispose(): void {
    for (const handle of this.timers.values()) clearTimeout(handle);
    this.timers.clear();
  }

  /** Window-expiry / execute_now: run resolution, then advance or finalize. */
  async resolveTurn(matchId: string): Promise<void> {
    this.clearTimer(matchId);
    const match = await this.deps.db.match.findUnique({ where: { id: matchId } });
    if (!match || match.status !== "ACTIVE") return;

    const proposals = await getProposals(this.deps.redis, matchId, match.turnNumber);
    const tallies = await getTallies(this.deps.redis, matchId, match.turnNumber);
    const resolution = resolveLeading(proposals, tallies);

    if (resolution.moveKey) {
      await executeMove(this.deps, matchId, resolution.moveKey);
      const updated = await this.deps.db.match.findUnique({ where: { id: matchId } });
      if (updated && updated.status === "ACTIVE") await this.openTurn(matchId);
    } else {
      // Empty ballot: re-arm the same turn (the side's time bank keeps draining).
      await clearTurn(this.deps.redis, matchId, match.turnNumber);
      await this.openTurn(matchId);
    }
  }

  // ---- socket handlers ----

  async onJoinMatch(socket: AppSocket, raw: unknown): Promise<void> {
    const matchId = (raw as { matchId?: string } | null)?.matchId ?? "";
    const match = await this.deps.db.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });
    if (!match) {
      socket.emit("error", { code: "not_in_match", message: "match not found" });
      return;
    }
    const participant = match.participants.find((p) => p.userId === socket.data.userId);
    if (!participant) {
      socket.emit("error", { code: "not_in_match", message: "not a participant" });
      return;
    }
    const color = participant.teamColor === "WHITE" ? "white" : "black";
    socket.data.matchId = matchId;
    socket.data.color = color;
    await joinMatchRooms(socket, matchId, color);
    await addPresence(this.deps.redis, matchId, color, socket.data.userId);
    socket.emit("match_start", {
      matchId,
      youAre: color,
      fen: match.fen,
      moveWindowSec: match.moveWindowSec,
    });
  }

  async onProposeMove(socket: AppSocket, raw: unknown): Promise<void> {
    let payload;
    try {
      payload = validateProposeMove(raw);
    } catch {
      socket.emit("error", { code: "invalid_payload", message: "bad propose_move" });
      return;
    }
    const match = await this.deps.db.match.findUnique({
      where: { id: payload.matchId },
      include: { participants: true },
    });
    if (!match || match.status !== "ACTIVE") {
      socket.emit("error", { code: "not_in_match", message: "match not active" });
      return;
    }
    const participant = match.participants.find((p) => p.userId === socket.data.userId);
    if (!participant) {
      socket.emit("error", { code: "not_in_match", message: "not a participant" });
      return;
    }
    const color = participant.teamColor === "WHITE" ? "white" : "black";
    const turnColor = match.turn === "WHITE" ? "white" : "black";
    if (color !== turnColor) {
      socket.emit("error", { code: "not_your_turn", message: "not your team's turn" });
      return;
    }

    const probe = new ChessEngine(match.fen);
    if (!probe.isLegal(payload.from, payload.to, payload.promotion)) {
      socket.emit("error", { code: "illegal_move", message: "illegal move" });
      return;
    }
    const san = probe.apply(payload.from, payload.to, payload.promotion).san;
    const key = makeMoveKey(payload.from, payload.to, payload.promotion);
    const added = await addProposal(this.deps.redis, payload.matchId, match.turnNumber, key, {
      id: crypto.randomUUID(),
      proposerUserId: socket.data.userId,
      san,
      from: payload.from,
      to: payload.to,
      promotion: payload.promotion,
    });
    if (added) {
      this.deps.io.to(colorRoom(payload.matchId, color)).emit("new_proposal", {
        moveKey: key,
        san,
        from: payload.from,
        to: payload.to,
        proposerUsername: socket.data.username,
      });
    }
  }

  async onVoteMove(socket: AppSocket, raw: unknown): Promise<void> {
    let payload;
    try {
      payload = validateVoteMove(raw);
    } catch {
      socket.emit("error", { code: "invalid_payload", message: "bad vote_move" });
      return;
    }
    const match = await this.deps.db.match.findUnique({
      where: { id: payload.matchId },
      include: { participants: true },
    });
    if (!match || match.status !== "ACTIVE") {
      socket.emit("error", { code: "not_in_match", message: "match not active" });
      return;
    }
    const participant = match.participants.find((p) => p.userId === socket.data.userId);
    if (!participant) {
      socket.emit("error", { code: "not_in_match", message: "not a participant" });
      return;
    }
    const color = participant.teamColor === "WHITE" ? "white" : "black";
    await castVote(this.deps.redis, payload.matchId, match.turnNumber, socket.data.userId, payload.moveKey);
    await this.broadcastTallies(payload.matchId, match.turnNumber, color);
  }

  async onExecuteNow(socket: AppSocket, raw: unknown): Promise<void> {
    const matchId = (raw as { matchId?: string } | null)?.matchId ?? "";
    const match = await this.deps.db.match.findUnique({
      where: { id: matchId },
      include: { participants: true },
    });
    if (!match || match.status !== "ACTIVE") return;
    if (!match.participants.some((p) => p.userId === socket.data.userId)) return;
    await this.resolveTurn(matchId);
  }

  async onSendChatMessage(socket: AppSocket, raw: unknown): Promise<void> {
    let payload;
    try {
      payload = validateSendChatMessage(raw);
    } catch {
      socket.emit("error", { code: "invalid_payload", message: "bad send_chat_message" });
      return;
    }
    const match = await this.deps.db.match.findUnique({
      where: { id: payload.matchId },
      include: { participants: true },
    });
    if (!match) return;
    const participant = match.participants.find((p) => p.userId === socket.data.userId);
    if (!participant) return;
    const color = participant.teamColor === "WHITE" ? "white" : "black";
    this.deps.io
      .to(colorRoom(payload.matchId, color))
      .emit("chat_message", {
        userId: socket.data.userId,
        username: socket.data.username,
        message: payload.message,
        at: new Date().toISOString(),
      });
  }

  async onDisconnect(socket: AppSocket): Promise<void> {
    if (socket.data.matchId && socket.data.color) {
      await removePresence(this.deps.redis, socket.data.matchId, socket.data.color, socket.data.userId);
    }
  }

  private async broadcastTallies(matchId: string, turnNumber: number, color: string): Promise<void> {
    const tallies = await getTallies(this.deps.redis, matchId, turnNumber);
    this.deps.io.to(colorRoom(matchId, color)).emit("vote_update", { tallies });
  }
}
