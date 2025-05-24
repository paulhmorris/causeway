import { expect, test } from "@playwright/test";

import { expectVisibleNotification } from "test/e2e/helpers/notifications";

test.use({ storageState: "playwright/.auth/admin.json" });
test.describe("Profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await page.getByRole("menuitem", { name: /profile/i }).click();
  });

  test("should display profile", async ({ page }) => {
    await expect(page).toHaveURL(/users/i);
    await expect(page).toHaveTitle(/user/i);
  });

  test("should display user details", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin E2E");
    await expect(page.getByRole("textbox", { name: /first name/i })).toHaveValue("Admin");
    await expect(page.getByRole("textbox", { name: /last name/i })).toHaveValue("E2E");
  });

  test("should update user first and last name", async ({ page }) => {
    await page.getByRole("textbox", { name: /first name/i }).fill("Updated");
    await page.getByRole("textbox", { name: /last name/i }).fill("E2E");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Updated E2E");
    await expectVisibleNotification(page, { expectedMessage: /updated/i, expectedType: "success" });
  });

  test("should not allow blank first, last, or username", async ({ page }) => {
    await page.getByRole("textbox", { name: /first name/i }).fill("");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/first name required/i)).toBeVisible();

    await page.getByRole("textbox", { name: /last name/i }).fill("");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/last name required/i)).toBeVisible();

    await page.getByRole("textbox", { name: /username/i }).fill("");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/username required/i)).toBeVisible();
  });

  test("should not allow invalid username", async ({ page }) => {
    await page.getByRole("textbox", { name: /username/i }).fill("invalid-email");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/username must be an email address/i)).toBeVisible();
  });

  test("should not be able to change role", async ({ page }) => {
    const roleSelect = page.getByLabel(/role/i);
    await expect(roleSelect).toBeDisabled();
  });
});
