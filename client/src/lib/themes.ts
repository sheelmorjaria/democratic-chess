/**
 * Runtime theme tokens.
 *
 * Most of the design system is driven by CSS custom properties in
 * `app/globals.css` (one block per `[data-theme]`). The values here mirror
 * ONLY the handful of tokens that the chessboard canvas needs as **JS values**
 * — react-chessboard's `custom*Style` / `customPieces` props take style objects
 * and render functions, not CSS vars. Keep these in sync with the
 * `[data-theme="…"]` board tokens in globals.css (small surface → low drift).
 */

export type ThemeId = "tournament" | "light" | "warm" | "neon";

export interface ThemePieceStyle {
  /** Glyph fill color. */
  fill: string;
  /** `-webkit-text-stroke` color (gives the silhouette its edge). */
  stroke: string;
}

export interface ThemePieces {
  white: ThemePieceStyle;
  black: ThemePieceStyle;
  /** Optional glow (text-shadow color) — used by the neon theme. */
  glow?: string;
}

export interface ThemeTokens {
  id: ThemeId;
  /** Human label shown in tooltips / aria. */
  label: string;
  /** Chessboard square + frame colors. */
  board: { light: string; dark: string; border: string };
  /** Square highlights (last move, legal target, king-in-check). */
  highlight: { lastMove: string; legalDot: string; check: string };
  /** Brand accent (vote bars, selected-piece ring). */
  accent: string;
  /** Per-theme chess piece rendering (Unicode silhouettes). */
  pieces: ThemePieces;
  /** Swatch-picker preview: background dot + accent pip. */
  swatch: { bg: string; fg: string };
}

/** Display order in the swatch picker (also the default fallback). */
export const THEME_ORDER: ThemeId[] = ["tournament", "light", "warm", "neon"];

export const DEFAULT_THEME: ThemeId = "tournament";

export const THEMES: Record<ThemeId, ThemeTokens> = {
  tournament: {
    id: "tournament",
    label: "Tournament",
    board: { light: "#eeeed2", dark: "#6f9650", border: "#2c343f" },
    highlight: { lastMove: "rgba(245,210,63,0.45)", legalDot: "rgba(232,237,242,0.32)", check: "#ef4444" },
    accent: "#e6c34a",
    pieces: {
      white: { fill: "#f4f1ea", stroke: "#2a2a2a" },
      black: { fill: "#262626", stroke: "#0a0a0a" },
    },
    swatch: { bg: "#14181d", fg: "#e6c34a" },
  },
  light: {
    id: "light",
    label: "Minimal light",
    board: { light: "#dee3e6", dark: "#8b9ba8", border: "#cfd5dd" },
    highlight: { lastMove: "rgba(79,70,229,0.28)", legalDot: "rgba(16,24,40,0.22)", check: "#dc2626" },
    accent: "#4f46e5",
    pieces: {
      white: { fill: "#ffffff", stroke: "#9aa4b2" },
      black: { fill: "#1f2937", stroke: "#0b1220" },
    },
    swatch: { bg: "#ffffff", fg: "#4f46e5" },
  },
  warm: {
    id: "warm",
    label: "Classic warm",
    board: { light: "#f0d9b5", dark: "#b58863", border: "#cbb98f" },
    highlight: { lastMove: "rgba(139,94,47,0.35)", legalDot: "rgba(58,45,24,0.24)", check: "#a8452f" },
    accent: "#8b5e2f",
    pieces: {
      white: { fill: "#fbf3e2", stroke: "#7a5a2e" },
      black: { fill: "#5a3d1e", stroke: "#2c1c0a" },
    },
    swatch: { bg: "#f7f1e6", fg: "#8b5e2f" },
  },
  neon: {
    id: "neon",
    label: "Glass / neon",
    board: { light: "#2a2658", dark: "#6d28d9", border: "rgba(255,255,255,0.18)" },
    highlight: { lastMove: "rgba(168,85,247,0.55)", legalDot: "rgba(243,238,255,0.34)", check: "#fb7185" },
    accent: "#a855f7",
    pieces: {
      white: { fill: "#f1ecff", stroke: "#c084fc" },
      black: { fill: "#3b1d6e", stroke: "#e9d5ff" },
      glow: "rgba(168,85,247,0.7)",
    },
    swatch: { bg: "#0a0918", fg: "#a855f7" },
  },
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(THEMES, v);
}
