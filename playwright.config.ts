import { defineConfig, devices } from "@playwright/test";

const docsUrl = "http://localhost:3100";
const exampleUrl = "http://localhost:3101";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command:
        "FORMADAPTER_E2E=1 bun --cwd=docs run dev -- --port 3100",
      env: { FORMADAPTER_E2E: "1" },
      stderr: "pipe",
      stdout: "pipe",
      timeout: 180_000,
      url: docsUrl,
    },
    {
      command:
        "FORMADAPTER_E2E=1 bun --cwd=examples/kitchen-sink run dev -- --port 3101",
      env: { FORMADAPTER_E2E: "1" },
      stderr: "pipe",
      stdout: "pipe",
      timeout: 180_000,
      url: exampleUrl,
    },
  ],
});

export { docsUrl, exampleUrl };
