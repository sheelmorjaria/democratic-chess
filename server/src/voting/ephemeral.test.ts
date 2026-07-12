import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import {
  addPresence,
  addProposal,
  castVote,
  clearTurn,
  getLeading,
  getProposals,
  getTallies,
  presenceCount,
  removePresence,
  type ProposalRecord,
} from "./ephemeral.js";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
const matchId = "11111111-1111-1111-1111-111111111111";
const turn = 1;
const e4Key = "e2:e4:-";
const d4Key = "d2:d4:-";

const e4: ProposalRecord = {
  id: "p1",
  proposerUserId: "u1",
  san: "e4",
  from: "e2",
  to: "e4",
};
const d4: ProposalRecord = {
  id: "p2",
  proposerUserId: "u1",
  san: "d4",
  from: "d2",
  to: "d4",
};

beforeEach(async () => {
  await clearTurn(redis, matchId, turn);
});

afterEach(async () => {
  await clearTurn(redis, matchId, turn);
});

describe("ephemeral proposals", () => {
  it("adds a proposal and collapses a duplicate move key", async () => {
    expect(await addProposal(redis, matchId, turn, e4Key, e4)).toBe(true);
    const duplicate: ProposalRecord = { ...e4, proposerUserId: "u2" };
    expect(await addProposal(redis, matchId, turn, e4Key, duplicate)).toBe(false);

    const proposals = await getProposals(redis, matchId, turn);
    expect(Object.keys(proposals)).toHaveLength(1);
    expect(proposals[e4Key]?.proposerUserId).toBe("u1");
  });
});

describe("ephemeral voting", () => {
  it("tallies votes and allows changing a vote", async () => {
    await addProposal(redis, matchId, turn, e4Key, e4);
    await addProposal(redis, matchId, turn, d4Key, d4);

    await castVote(redis, matchId, turn, "voter1", e4Key);
    let tallies = await getTallies(redis, matchId, turn);
    expect(tallies.find((t) => t.moveKey === e4Key)?.count).toBe(1);

    await castVote(redis, matchId, turn, "voter1", d4Key);
    tallies = await getTallies(redis, matchId, turn);
    expect(tallies.find((t) => t.moveKey === e4Key)?.count).toBe(0);
    expect(tallies.find((t) => t.moveKey === d4Key)?.count).toBe(1);

    const leading = await getLeading(redis, matchId, turn);
    expect(leading?.moveKey).toBe(d4Key);
  });
});

describe("ephemeral presence", () => {
  it("tracks connected members per color", async () => {
    await addPresence(redis, matchId, "white", "a");
    await addPresence(redis, matchId, "white", "b");
    expect(await presenceCount(redis, matchId, "white")).toBe(2);

    await removePresence(redis, matchId, "white", "a");
    expect(await presenceCount(redis, matchId, "white")).toBe(1);
  });
});
