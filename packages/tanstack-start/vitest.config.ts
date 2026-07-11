import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@tanstack/react-start": fileURLToPath(
        new URL("./test/fixtures/react-start.ts", import.meta.url),
      ),
    },
  },
  test: {
    clearMocks: true,
    environment: "happy-dom",
    include: ["packages/tanstack-start/test/**/*.{test,spec}.{ts,tsx}"],
    mockReset: true,
    restoreMocks: true,
    root: workspaceRoot,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      exclude: ["**/*.d.ts"],
      include: ["packages/tanstack-start/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage/tanstack-start",
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
