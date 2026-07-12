import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "server/**/*.test.ts",
      "packages/**/*.test.ts",
      "client/**/*.test.{ts,tsx}",
    ],
    environment: "node",
  },
});
