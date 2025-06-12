import { expect, test } from "@playwright/test";

test.use({ colorScheme: "light" });

test.describe("User menu", () => {
  test("should open and close", async ({ page }) => {
    await page.goto("/dashboards/admin");
    await expect(page).toHaveURL("/dashboards/admin");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await expect(page.getByRole("menuitem", { name: /profile/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: /profile/i })).toBeHidden();
  });

  test("should display options", async ({ page }) => {
    await page.goto("/dashboards/admin");
    await expect(page).toHaveURL("/dashboards/admin");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await expect(page.getByRole("menuitem", { name: /profile/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /feature request/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /log out/i })).toBeVisible();
  });

  test("should navigate to profile", async ({ page }) => {
    await page.goto("/dashboards/admin");
    await expect(page).toHaveURL("/dashboards/admin");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await page.getByRole("menuitem", { name: /profile/i }).click();
    await expect(page).toHaveURL(/users/i);
  });

  test("should navigate to feature request", async ({ page }) => {
    await page.goto("/dashboards/admin");
    await expect(page).toHaveURL("/dashboards/admin");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await page.getByRole("menuitem", { name: /feature request/i }).click();
    await expect(page).toHaveURL("/feature-request");
  });

  test("should toggle theme", async ({ page }) => {
    await page.goto("/dashboards/admin");
    await expect(page).toHaveURL("/dashboards/admin");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await page.getByRole("button", { name: /toggle theme/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: /toggle theme/i }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await expect(page).toHaveURL("/dashboards/admin");
  });

  test("should log out", async ({ page }) => {
    await page.goto("/dashboards/admin");
    await expect(page).toHaveURL("/dashboards/admin");
    await page.getByRole("button", { name: /open user menu/i }).click();
    await page.getByRole("menuitem", { name: /log out/i }).click();
    await expect(page).toHaveURL("/login");
  });
});
