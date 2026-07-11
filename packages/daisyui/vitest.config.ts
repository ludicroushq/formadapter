import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "happy-dom",
    include: ["packages/daisyui/test/**/*.{test,spec}.{ts,tsx}"],
    mockReset: true,
    restoreMocks: true,
    root: workspaceRoot,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      exclude: ["**/*.d.ts"],
      include: ["packages/daisyui/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage/daisyui",
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
