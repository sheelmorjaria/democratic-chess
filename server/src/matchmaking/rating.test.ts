import { describe, expect, it } from "vitest";
import { applyElo, INITIAL_RATING, kFactor, PROVISIONAL_GAMES } from "./rating.js";

describe("kFactor", () => {
  it("is 32 while provisional and 24 once settled", () => {
    expect(kFactor(0)).toBe(32);
    expect(kFactor(PROVISIONAL_GAMES - 1)).toBe(32);
    expect(kFactor(PROVISIONAL_GAMES)).toBe(24);
  });
});

describe("applyElo", () => {
  it("raises the winner and lowers the loser from equal ratings (zero-sum)", () => {
    const result = applyElo(
      { rating: INITIAL_RATING, provisionalGames: 50 },
      { rating: INITIAL_RATING, provisionalGames: 50 },
      1,
    );
    expect(result.a).toBeGreaterThan(INITIAL_RATING);
    expect(result.b).toBeLessThan(INITIAL_RATING);
    expect(result.a + result.b).toBe(2 * INITIAL_RATING);
  });

  it("barely moves ratings when a heavy favorite beats an underdog", () => {
    const result = applyElo({ rating: 2000, provisionalGames: 50 }, { rating: 1000, provisionalGames: 50 }, 1);
    expect(result.a - 2000).toBeLessThan(5);
    expect(1000 - result.b).toBeLessThan(5);
  });

  it("pulls ratings toward each other on a draw", () => {
    const result = applyElo({ rating: 1300, provisionalGames: 50 }, { rating: 1100, provisionalGames: 50 }, 0.5);
    expect(result.a).toBeLessThan(1300);
    expect(result.b).toBeGreaterThan(1100);
  });
});
