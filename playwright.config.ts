import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3000";
const isCI = process.env.CI;

export default defineConfig({
  testDir: "./test/e2e",
  timeout: isCI ? 30_000 : 15_000,
  testIgnore: !isCI ? "./test/e2e/a11y.test.ts" : undefined,
  fullyParallel: true,
  forbidOnly: !!isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? "html" : "list",
  use: {
    baseURL,
  },

  projects: [
    // Setup
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      teardown: "cleanup db",
    },
    {
      name: "cleanup db",
      testMatch: /global\.teardown\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
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
    command: "npm run dev",
    reuseExistingServer: true,
  },
});
