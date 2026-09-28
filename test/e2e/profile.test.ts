import { expect, test as base } from "@playwright/test";
import { createAdmin, signIn } from "test/e2e/helpers/auth";
import { expectVisibleNotification } from "test/e2e/helpers/notifications";

const test = base.extend<{ user: Awaited<ReturnType<typeof createAdmin>> }>({
  user: async ({ page }, use) => {
    const user = await createAdmin();
    await signIn(page, user.username);
    await use(user);
  },
});

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Profile", () => {
  test.beforeEach(async ({ page, user }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await page.getByRole("menuitem", { name: /profile/i }).click();
    await expect(page).toHaveURL(`/users/${user.id}/profile`);
  });

  test("should display user details", async ({ page }) => {
    await expect(page).toHaveTitle("Admin E2E");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin E2E");
    await expect(page.getByRole("textbox", { name: /first name/i })).toHaveValue("Admin");
    await expect(page.getByRole("textbox", { name: /last name/i })).toHaveValue("E2E");
  });

  test("should update user first and last name", async ({ page }) => {
    await page.getByRole("textbox", { name: /first name/i }).fill("Updated");
    await page.getByRole("textbox", { name: /last name/i }).fill("Name");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Updated Name");
    await expectVisibleNotification(page, { expectedMessage: /updated/i, expectedType: "success" });
  });

  test("should not allow blank first name", async ({ page }) => {
    await page.getByRole("textbox", { name: /first name/i }).fill("");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test("should allow blank last name", async ({ page }) => {
    await page.getByRole("textbox", { name: /last name/i }).fill("");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Admin");
    await expectVisibleNotification(page, { expectedMessage: /updated/i, expectedType: "success" });
  });

  test("should not allow blank username", async ({ page }) => {
    await page.getByRole("textbox", { name: /username/i }).fill("");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test("should not allow invalid username", async ({ page }) => {
    await page.getByRole("textbox", { name: /username/i }).fill("invalid-email");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/invalid email address/i)).toBeVisible();
  });

  test("should not be able to change role", async ({ page }) => {
    await expect(page.getByLabel(/role/i)).toBeDisabled();
  });
});
