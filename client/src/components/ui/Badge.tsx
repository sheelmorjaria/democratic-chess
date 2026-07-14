import { type ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "info" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const cls = tone === "neutral" ? "dc-badge" : `dc-badge dc-badge--${tone}`;
  return <span className={cls}>{children}</span>;
}
