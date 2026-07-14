"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME, THEMES, isThemeId, type ThemeId, type ThemeTokens } from "./themes";

/**
 * Theme provider. The active theme is written to `document.documentElement` as
 * `data-theme="…"` (the CSS variable source of truth) and persisted to
 * `localStorage`. An inline script in `app/layout.tsx` applies the stored /
 * system-preferred theme BEFORE first paint to avoid a flash; this provider
 * mirrors that value into React state so components (board canvas, swatches)
 * can read it.
 */

const STORAGE_KEY = "dc-theme";

interface ThemeContextValue {
  theme: ThemeId;
  tokens: ThemeTokens;
  setTheme: (t: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isThemeId(stored)) return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default on the server + first client render; the no-flash script has
  // already set the right `data-theme` attribute, and the effect below syncs
  // React state immediately after hydration.
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const t = resolveInitialTheme();
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private mode / disabled storage — ignore */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, tokens: THEMES[theme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
