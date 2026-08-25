import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    globals: true,
    environment: "node",
    // DB-backed tests use a dedicated SQLite file so they never touch dev data.
    env: { DATABASE_URL: "file:./prisma/test.db" },
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    hookTimeout: 60000,
  },
});
