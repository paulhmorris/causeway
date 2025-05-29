import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { expectVisibleNotification } from "test/e2e/helpers/notifications";

dayjs.extend(utc);

test.use({ storageState: "playwright/.auth/admin.json" });
test.describe("Add transfer", () => {
  // Sometimes the transfer submission just doesn't ever load the next page
  test.describe.configure({ retries: 3 });
  test.beforeEach(async ({ page }) => {
    await page.goto("/transfer/new");
  });

  test("should not add transfer with all empty fields", async ({ page }) => {
    await page.getByRole("button", { name: /submit/i }).click();

    await expect(page).toHaveURL("/transfer/new");
    await expect(page.getByRole("textbox", { name: "Amount" })).toBeFocused();
  });

  test("should not allow transfers between the same account", async ({ page }) => {
    // Fill out form
    await page.getByLabel("Select from account").click();
    await page.getByLabel("9998").click();
    await page.getByLabel("Select to account").click();
    const sameAccount = page.getByLabel("9998");
    await expect(sameAccount).toBeDisabled();
  });

  test("should not allow transfers of $0.00", async ({ page }) => {
    // Fill out form
    await page.getByLabel("Select from account").click();
    await page.getByLabel("9998").click();
    await page.getByLabel("Select to account").click();
    await page.getByLabel("9999").click();
    await page.getByRole("textbox", { name: "Amount" }).fill("0");
    await page.getByRole("button", { name: /submit/i }).click();

    // Verify toast message
    await expect(page.getByText("Amount must be greater than $0.00")).toBeVisible();
  });

  test("should not allow an overdraft", async ({ page }) => {
    // Fill out form
    await page.getByLabel("Select from account").click();
    await page.getByLabel("9998").click();
    await page.getByLabel("Select to account").click();
    await page.getByLabel("9999").click();
    await page.getByRole("textbox", { name: "Amount" }).fill("10000");
    await page.getByRole("button", { name: /submit/i }).click();

    // Verify toast message
    await expectVisibleNotification(page, { expectedType: "error" });
  });

  test("should add transfer with valid fields", async ({ page }) => {
    const amount = faker.number.float({ multipleOf: 0.01, min: 1, max: 1000 });

    // Add income to first account
    await page.goto("/income/new");
    await page.getByLabel("Note").fill("Test transaction");
    await page.getByLabel("Category").click();
    await page.getByLabel("Expense: Other").click();
    await page.getByLabel("Select account").click();
    await page.getByLabel("9998").click();
    await page.getByRole("textbox", { name: "Amount" }).fill((amount + 1).toString());

    await page.getByLabel("Select method").click();
    await page.getByLabel("ACH").click();

    await page.getByLabel("Select type").click();
    await page.getByLabel("Donation").click();
    await page.getByRole("button", { name: /submit/i }).click();

    await expect(page).toHaveURL(/accounts/);
    await expect(page.getByRole("heading", { name: /9998/i })).toBeVisible();

    // Fill out form
    await page.goto("/transfer/new");
    await page.getByLabel("Select from account").click();
    await page.getByLabel("9998").click();
    await page.getByLabel("Select to account").click();
    await page.getByLabel("9999").click();
    await page.getByRole("textbox", { name: "Amount" }).fill(amount.toString());
    await page.getByRole("button", { name: /submit/i }).click();

    await page.waitForURL(/accounts/);
    // Verify toast message
    await expectVisibleNotification(page, { expectedType: "success" });
    await page.getByLabel("Close toast").click();

    // Verifiy transfer went through
    await expect(page).toHaveURL(/accounts/);
    await expect(page.getByRole("heading", { name: /9999/i })).toBeVisible();

    // Verify transaction in "to" amount is correct
    await expect(page.getByRole("heading", { name: /9999/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: amount.toString() })).toBeVisible();

    // Verify transaction in "from" amount is correct
    await page.goto("/accounts");
    await page.getByRole("row", { name: "9998" }).getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/accounts/);
    await expect(page.getByRole("heading", { name: /9998/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: amount.toString() })).toBeVisible();
  });
});
