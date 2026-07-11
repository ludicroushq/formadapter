import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: workspaceRoot,
  test: {
    clearMocks: true,
    environment: "happy-dom",
    include: ["packages/server/test/**/*.{test,spec}.{ts,tsx}"],
    mockReset: true,
    restoreMocks: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      exclude: ["**/*.d.ts"],
      include: ["packages/server/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage/server",
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
