import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  test: {
    clearMocks: true,
    environment: "happy-dom",
    include: ["packages/*/test/**/*.{test,spec}.{ts,tsx}"],
    mockReset: true,
    restoreMocks: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      exclude: ["**/*.d.ts"],
      include: ["packages/*/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95
      }
    }
  }
});
