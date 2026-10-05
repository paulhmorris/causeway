import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3002";
const isCI = process.env.CI;

export default defineConfig({
  testDir: "./test/e2e",
  globalSetup: "./test/e2e/helpers/global.setup.ts",
  timeout: isCI ? 30_000 : 15_000,
  testIgnore: !isCI ? "**/a11y.test.ts" : undefined,
  fullyParallel: true,
  forbidOnly: !!isCI,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["dot"], ["html"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    // Setup
    {
      name: "db setup",
      testMatch: /db\.setup\.ts/,
      teardown: "cleanup db",
    },
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["db setup"],
    },
    {
      name: "cleanup db",
      testMatch: /global\.teardown\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
    // {
    //   name: "firefox",
    //   use: {
    //     ...devices["Desktop Firefox"],
    //     storageState: "playwright/.auth/admin.json",
    //   },
    //   dependencies: ["setup"],
    // },

    // {
    //   name: "webkit",
    //   use: {
    //     ...devices["Desktop Safari"],
    //     storageState: "playwright/.auth/admin.json",
    //   },
    //   dependencies: ["setup"],
    // },

    // {
    //   name: "mobile",
    //   use: {
    //     ...devices["iPhone 14"],
    //     storageState: "playwright/.auth/admin.json",
    //   },
    //   dependencies: ["setup"],
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    url: baseURL,
    command: `npm run dev -- --port ${new URL(baseURL).port}`,
    reuseExistingServer: true,
  },
});
