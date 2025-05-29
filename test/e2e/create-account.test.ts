import { expect, test } from "@playwright/test";
import { nanoid } from "nanoid";

import { expectVisibleNotification } from "test/e2e/helpers/notifications";

test.use({ storageState: "playwright/.auth/admin.json" });
test.describe("Create account", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/accounts/new");
  });

  test("should create account with valid fields", async ({ page }) => {
    // Fill out form
    const code = nanoid();
    await page.getByLabel("Code").fill(code);
    await page.getByLabel("Description").fill("E2E - Test account");
    await page.getByLabel("Type").click();
    await page.getByLabel("Operating").click();
    await page.getByRole("button", { name: /create account/i }).click();

    // Verify account creation
    await page.waitForURL(/accounts/);
    await expectVisibleNotification(page, { expectedType: "success" });
    await expect(page.getByRole("heading", { name: code })).toBeVisible();
  });
});
