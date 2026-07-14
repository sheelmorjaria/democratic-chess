"use client";

import { useTheme } from "@/lib/theme";
import { THEME_ORDER, THEMES } from "@/lib/themes";

/** Header theme picker — one swatch per theme, accent pip on the theme's bg. */
export function ThemeSwatches() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="dc-swatches" role="group" aria-label="Color theme">
      {THEME_ORDER.map((id) => {
        const t = THEMES[id];
        const active = id === theme;
        return (
          <button
            key={id}
            type="button"
            className={["dc-swatch", active ? "dc-swatch--active" : ""].filter(Boolean).join(" ")}
            style={{ background: t.swatch.bg, position: "relative" }}
            aria-pressed={active}
            aria-label={`${t.label} theme`}
            title={t.label}
            onClick={() => setTheme(id)}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                margin: "auto",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: t.swatch.fg,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
