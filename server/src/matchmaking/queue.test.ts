import { afterEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { findMatch, findSoloVsTeam, joinQueue, leaveQueue } from "./queue.js";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
const type = `test-${Math.random().toString(36).slice(2, 8)}`;

afterEach(async () => {
  await leaveQueue(redis, type, "a");
  await leaveQueue(redis, type, "b");
});

describe("matchmaking queue", () => {
  it("pairs two entries within the base band immediately", async () => {
    await joinQueue(redis, type, "a", 1200, 0);
    await joinQueue(redis, type, "b", 1300, 0); // 100 apart, within base band 100
    const pair = await findMatch(redis, type, 0);
    expect(pair).toEqual({ a: expect.any(String), b: expect.any(String) });
  });

  it("does not pair entries outside the band at enqueue time", async () => {
    await joinQueue(redis, type, "a", 1200, 0);
    await joinQueue(redis, type, "b", 1400, 0); // 200 apart, outside base band 100
    expect(await findMatch(redis, type, 0)).toBeNull();
  });

  it("pairs once the band widens enough with age", async () => {
    await joinQueue(redis, type, "a", 1200, 0);
    await joinQueue(redis, type, "b", 1400, 0);
    expect(await findMatch(redis, type, 0)).toBeNull();
    // 3s older -> band = 100 + 3*50 = 250 >= 200 apart.
    expect(await findMatch(redis, type, 3000)).not.toBeNull();
  });
});

describe("solo-vs-team cross-type pairing", () => {
  const suf = Math.random().toString(36).slice(2, 8);
  // Unique namespaces so these tests never collide with other files using the
  // global SOLO/TEAM sets (e.g. competitive.test) when run in parallel.
  const soloType = `SOLO-${suf}`;
  const teamType = `TEAM-${suf}`;
  const solo = `solo-${suf}`;
  const team = `team-${suf}`;

  afterEach(async () => {
    await leaveQueue(redis, soloType, solo);
    await leaveQueue(redis, teamType, team);
  });

  it("pairs a queued solo with a queued team within the band", async () => {
    await joinQueue(redis, soloType, solo, 1200, 0);
    await joinQueue(redis, teamType, team, 1250, 0); // 50 apart, within base band
    const pair = await findSoloVsTeam(redis, 0, soloType, teamType);
    expect(pair).toEqual({ solo: expect.any(String), team: expect.any(String) });
    expect(pair!.solo).toBe(solo);
    expect(pair!.team).toBe(team);
  });

  it("does not pair a solo and team outside the band at enqueue time", async () => {
    await joinQueue(redis, soloType, solo, 1200, 0);
    await joinQueue(redis, teamType, team, 1500, 0); // 300 apart, outside base band
    expect(await findSoloVsTeam(redis, 0, soloType, teamType)).toBeNull();
  });

  it("pairs once the band widens enough with age", async () => {
    await joinQueue(redis, soloType, solo, 1200, 0);
    await joinQueue(redis, teamType, team, 1500, 0); // 300 apart
    expect(await findSoloVsTeam(redis, 0, soloType, teamType)).toBeNull();
    // 5s older -> band = 100 + 5*50 = 350 >= 300 apart.
    expect(await findSoloVsTeam(redis, 5000, soloType, teamType)).not.toBeNull();
  });
});
