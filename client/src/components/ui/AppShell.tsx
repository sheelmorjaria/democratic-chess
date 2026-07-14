import { type ReactNode } from "react";
import { Header } from "./Header";

/** Page chrome: sticky header + centered, max-width content region. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="dc-main">{children}</main>
    </>
  );
}
