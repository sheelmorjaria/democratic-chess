import { describe, expect, it } from "vitest";
import type { ProposalRecord } from "../voting/ephemeral.js";
import { resolveLeading } from "./turnEngine.js";

function proposal(id: string, proposedAt: number): ProposalRecord {
  return { id, proposerUserId: "u", san: "e4", from: "e2", to: "e4", proposedAt };
}

describe("resolveLeading (US1)", () => {
  it("returns empty when the ballot has no proposals", () => {
    expect(resolveLeading({}, [])).toEqual({ moveKey: null, reason: "empty" });
  });

  it("picks the highest-voted proposal", () => {
    const proposals = { "e2:e4:-": proposal("p1", 1), "d2:d4:-": proposal("p2", 2) };
    const tallies = [
      { moveKey: "e2:e4:-", count: 3 },
      { moveKey: "d2:d4:-", count: 5 },
    ];
    expect(resolveLeading(proposals, tallies).moveKey).toBe("d2:d4:-");
  });

  it("breaks a tie by earliest proposedAt", () => {
    const proposals = { "d2:d4:-": proposal("p2", 10), "e2:e4:-": proposal("p1", 1) };
    const tallies = [
      { moveKey: "d2:d4:-", count: 2 },
      { moveKey: "e2:e4:-", count: 2 },
    ];
    expect(resolveLeading(proposals, tallies).moveKey).toBe("e2:e4:-");
  });

  it("falls back to earliest proposal when all counts are zero", () => {
    const proposals = { "d2:d4:-": proposal("p2", 9), "e2:e4:-": proposal("p1", 3) };
    const tallies = [{ moveKey: "d2:d4:-", count: 0 }];
    expect(resolveLeading(proposals, tallies).moveKey).toBe("e2:e4:-");
  });
});
