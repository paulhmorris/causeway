import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import { expectVisibleNotification } from "test/e2e/helpers/notifications";
import { formatCurrency } from "~/lib/utils";

dayjs.extend(utc);

test.describe("Add Income", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/income/new");
  });

  test("should not add income with all empty fields", async ({ page }) => {
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page).toHaveURL("/income/new");
  });

  test("should allow adding and deleting transaction items", async ({ page }) => {
    await page.getByRole("button", { name: /add item/i }).click();
    await expect(page.getByRole("heading", { name: /item 2/i })).toBeVisible();
    await page.getByRole("button", { name: /remove item 2/i }).click();
    await expect(page.getByRole("heading", { name: /item 2/i })).toBeHidden();
  });

  test("should add income with valid fields", async ({ page }) => {
    const amount = faker.number.float({ multipleOf: 0.01, min: 1, max: 1000 });
    // Fill out form
    await page.getByLabel("Note").fill("Test transaction");
    await page.getByLabel("Category").click();
    await page.getByLabel("Donation: Standard").click();
    await page.getByLabel("Select account").click();
    await page.getByLabel("9998").click();
    await page.getByRole("textbox", { name: "Amount" }).fill(amount.toString());

    await page.getByLabel("Select method").click();
    await page.getByLabel("ACH").click();

    await page.getByLabel("Select type").click();
    await page.getByLabel("Donation").click();
    await page.getByRole("button", { name: /submit/i }).click();

    // Verifiy transaction went through
    await expect(page).toHaveURL(/accounts/);
    await expect(page.getByRole("heading", { name: /9998/i })).toBeVisible();

    // Verify toast message
    await expectVisibleNotification(page, { expectedType: "success" });

    // Verify transaction amount is correct
    const trx = page.getByRole("row", { name: formatCurrency(amount) });
    await expect(trx).toBeVisible();

    // Verify transaction link
    await trx.getByRole("link", { name: /view/i }).click();
    await expect(page).toHaveURL(/transactions/);

    // Verify transaction details
    await expect(page.getByRole("heading", { name: /transaction details/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: amount.toString() })).toBeVisible();
    await expect(page.getByText(dayjs().format("MM/DD/YYYY"))).toBeVisible();
    await expect(page.getByText("Donation: Standard")).toBeVisible();
    await expect(page.getByText("Test transaction")).toBeVisible();

    // Verify account link
    await page.getByRole("link", { name: /9998/i }).click();
    await expect(page).toHaveURL(/accounts/);
    await expect(page.getByRole("heading", { name: /9998/i })).toBeVisible();
  });
});
