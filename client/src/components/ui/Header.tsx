"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ThemeSwatches } from "./ThemeSwatches";

/** Global top bar: brand, nav, theme picker, auth state. */
export function Header() {
  const { user, ready, logout } = useAuth();
  return (
    <header className="dc-header">
      <div className="dc-header__inner">
        <Link href="/" className="dc-brand">
          <span className="dc-brand__mark" aria-hidden>
            ♞
          </span>
          <span>DemocraticChess</span>
        </Link>

        <nav className="dc-nav" aria-label="Primary">
          <Link href="/lobby" className="dc-nav__link">
            Lobby
          </Link>
          <Link href="/leaderboard" className="dc-nav__link">
            Leaderboard
          </Link>
        </nav>

        <div className="dc-header__right">
          <ThemeSwatches />
          {ready && user ? (
            <span className="dc-user">
              <span className="dc-avatar" aria-hidden>
                {user.username.slice(0, 1).toUpperCase()}
              </span>
              <button type="button" className="dc-btn dc-btn--ghost dc-btn--sm" onClick={logout}>
                Log out
              </button>
            </span>
          ) : ready ? (
            <Link href="/login" className="dc-btn dc-btn--primary dc-btn--sm">
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
