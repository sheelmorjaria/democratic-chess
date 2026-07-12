import { describe, expect, it } from "vitest";
import { ChessEngine } from "./engine.js";

describe("ChessEngine", () => {
  it("starts at the standard FEN with white to move", () => {
    const engine = new ChessEngine();
    expect(engine.turn).toBe("white");
    expect(engine.fen).toContain(" w ");
  });

  it("applies a legal move and flips the turn", () => {
    const engine = new ChessEngine();
    const move = engine.apply("e2", "e4");
    expect(move.san).toBe("e4");
    expect(engine.turn).toBe("black");
  });

  it("flags an illegal move as not legal", () => {
    const engine = new ChessEngine();
    expect(engine.isLegal("e2", "e5")).toBe(false);
  });

  it("does not mutate state when probing legality", () => {
    const engine = new ChessEngine();
    expect(engine.isLegal("e2", "e4")).toBe(true);
    expect(engine.turn).toBe("white");
  });

  it("detects fool's mate as a black checkmate", () => {
    const engine = new ChessEngine();
    engine.apply("f2", "f3");
    engine.apply("e7", "e5");
    engine.apply("g2", "g4");
    engine.apply("d8", "h4");
    const status = engine.gameStatus();
    expect(status.over).toBe(true);
    expect(status.winner).toBe("black");
    expect(status.reason).toBe("checkmate");
  });
});
