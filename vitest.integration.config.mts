import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Runs the service layer against a real (throwaway) database.
// Start it with `npm run test:integration`, which provisions that database.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path("./tests/stubs/server-only.ts"),
      "@": path("./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // One database, so one file at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
