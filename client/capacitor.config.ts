import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the Next.js build for iOS/Android (constitution III: one
 * codebase for web + mobile). Requires `output: "export"` in next.config.mjs
 * (static export to ./out) before `npx cap add ios` / `npx cap add android`.
 */
const config: CapacitorConfig = {
  appId: "com.democraticchess.app",
  appName: "DemocraticChess",
  webDir: "out",
  server: { androidScheme: "https" },
};

export default config;
