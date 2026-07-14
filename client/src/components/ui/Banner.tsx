import { type ReactNode } from "react";

export type BannerTone = "info" | "success" | "warning" | "error";

export function Banner({ tone = "info", children }: { tone?: BannerTone; children: ReactNode }) {
  return (
    <div
      className={`dc-banner dc-banner--${tone}`}
      role="status"
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
