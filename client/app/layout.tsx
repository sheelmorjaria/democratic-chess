import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "@/components/ui/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "DemocraticChess",
  description: "Real-time, synchronous team chess.",
};

/**
 * No-flash theme bootstrap. Runs before first paint to set `data-theme` from
 * localStorage (or the system color scheme), so the correct theme's CSS
 * variables apply immediately. `suppressHydrationWarning` on <html> silences
 * the resulting attribute diff vs React's server render.
 */
const themeBootstrap = `(function(){try{var a=['tournament','light','warm','neon'];var t=localStorage.getItem('dc-theme');if(a.indexOf(t)===-1){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'tournament';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="tournament" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
