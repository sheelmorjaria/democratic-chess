import { type ReactNode } from "react";
import { Header } from "./Header";

/** Page chrome: sticky header + centered, max-width content region. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#dc-content" className="dc-skip-link">
        Skip to content
      </a>
      <Header />
      <main id="dc-content" className="dc-main">
        {children}
      </main>
    </>
  );
}
