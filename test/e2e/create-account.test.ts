import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/admin.json" });
test.describe("Create account", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/accounts/new");
  });

  test("should create account with valid fields", async ({ page }) => {
    // Fill out form
    await page.getByLabel("Code").fill("99999");
    await page.getByLabel("Description").fill("E2E - Test account");
    await page.getByLabel("Type").click();
    await page.getByLabel("Operating").click();
    await page.getByRole("button", { name: /create account/i }).click();

    // Verify account creation
    await expect(page).toHaveURL(/accounts/);
    await expect(page.getByRole("heading", { name: /99999/i })).toBeVisible();

    // Verify toast message
    await expect(page.getByRole("status")).toBeVisible();
  });
});
