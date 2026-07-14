/**
 * Runtime theme tokens.
 *
 * Most of the design system is driven by CSS custom properties in
 * `app/globals.css` (one block per `[data-theme]`). The values here mirror
 * ONLY the handful of tokens that the chessboard canvas needs as **JS values**
 * — react-chessboard's `custom*Style` props take style objects, not CSS vars.
 * Keep these in sync with the `[data-theme="…"]` board tokens in globals.css
 * (the surface is tiny, so drift risk is low).
 */

export type ThemeId = "tournament" | "light" | "warm" | "neon";

export interface ThemeTokens {
  id: ThemeId;
  /** Human label shown in tooltips / aria. */
  label: string;
  /** Chessboard square + frame colors. */
  board: { light: string; dark: string; border: string };
  /** Square highlights (last move, legal target, king-in-check). */
  highlight: { lastMove: string; legalDot: string; check: string };
  /** Brand accent (used for vote bars, selected outlines). */
  accent: string;
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
    highlight: { lastMove: "rgba(245,210,63,0.45)", legalDot: "rgba(232,237,242,0.30)", check: "#ef4444" },
    accent: "#e6c34a",
    swatch: { bg: "#14181d", fg: "#e6c34a" },
  },
  light: {
    id: "light",
    label: "Minimal light",
    board: { light: "#dee3e6", dark: "#8b9ba8", border: "#cfd5dd" },
    highlight: { lastMove: "rgba(79,70,229,0.28)", legalDot: "rgba(16,24,40,0.22)", check: "#dc2626" },
    accent: "#4f46e5",
    swatch: { bg: "#ffffff", fg: "#4f46e5" },
  },
  warm: {
    id: "warm",
    label: "Classic warm",
    board: { light: "#f0d9b5", dark: "#b58863", border: "#cbb98f" },
    highlight: { lastMove: "rgba(139,94,47,0.35)", legalDot: "rgba(58,45,24,0.22)", check: "#a8452f" },
    accent: "#8b5e2f",
    swatch: { bg: "#f7f1e6", fg: "#8b5e2f" },
  },
  neon: {
    id: "neon",
    label: "Glass / neon",
    board: { light: "#2a2658", dark: "#6d28d9", border: "rgba(255,255,255,0.18)" },
    highlight: { lastMove: "rgba(168,85,247,0.55)", legalDot: "rgba(243,238,255,0.30)", check: "#fb7185" },
    accent: "#a855f7",
    swatch: { bg: "#0a0918", fg: "#a855f7" },
  },
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(THEMES, v);
}
