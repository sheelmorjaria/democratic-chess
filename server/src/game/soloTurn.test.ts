import { describe, expect, it } from "vitest";
import { isSoloSide, isSoloTurn, soloColor } from "./soloTurn.js";
import type { Match } from "@prisma/client";

type SoloFixture = Pick<Match, "mode" | "whiteTeamId" | "blackTeamId" | "turn">;

const soloWhite: SoloFixture = {
  mode: "SOLO_VS_TEAM",
  whiteTeamId: null,
  blackTeamId: "team-1",
  turn: "WHITE",
};
const soloBlack: SoloFixture = {
  mode: "SOLO_VS_TEAM",
  whiteTeamId: "team-1",
  blackTeamId: null,
  turn: "BLACK",
};
const teamVsTeam: SoloFixture = {
  mode: "TEAM_VS_TEAM",
  whiteTeamId: "team-1",
  blackTeamId: "team-2",
  turn: "WHITE",
};

describe("solo side identification", () => {
  it("identifies the solo color as the side with no team", () => {
    expect(soloColor(soloWhite)).toBe("WHITE");
    expect(soloColor(soloBlack)).toBe("BLACK");
  });

  it("returns null for team-vs-team or malformed matches", () => {
    expect(soloColor(teamVsTeam)).toBeNull();
    expect(soloColor({ ...soloWhite, whiteTeamId: null, blackTeamId: null })).toBeNull();
  });

  it("flags only the solo color as a solo side", () => {
    expect(isSoloSide(soloWhite, "WHITE")).toBe(true);
    expect(isSoloSide(soloWhite, "BLACK")).toBe(false);
    expect(isSoloSide(teamVsTeam, "WHITE")).toBe(false);
  });

  it("reports whether it is currently the solo player's turn", () => {
    expect(isSoloTurn(soloWhite)).toBe(true);
    expect(isSoloTurn({ ...soloWhite, turn: "BLACK" })).toBe(false);
    expect(isSoloTurn(teamVsTeam)).toBe(false);
  });
});
