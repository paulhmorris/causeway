import { expect, test } from "./helpers/axe-test";

test.describe("should have no a11y issues on", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("login", async ({ page, makeAxeBuilder }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/login");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

test.describe("should have no a11y issues on", () => {
  test("dashboard", async ({ page, makeAxeBuilder }) => {
    await page.goto("/dashboards/admin");
    await expect(page).toHaveURL("/dashboards/admin");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("accounts index", async ({ page, makeAxeBuilder }) => {
    await page.goto("/accounts");
    await expect(page).toHaveURL("/accounts");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("account create", async ({ page, makeAxeBuilder }) => {
    await page.goto("/accounts/new");
    await expect(page).toHaveURL("/accounts/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  // contacts
  test("contacts index", async ({ page, makeAxeBuilder }) => {
    await page.goto("/contacts");
    await expect(page).toHaveURL("/contacts");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("contact create", async ({ page, makeAxeBuilder }) => {
    await page.goto("/contacts/new");
    await expect(page).toHaveURL("/contacts/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  // engagements
  test("engagements index", async ({ page, makeAxeBuilder }) => {
    await page.goto("/engagements");
    await expect(page).toHaveURL("/engagements");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("engagement create", async ({ page, makeAxeBuilder }) => {
    await page.goto("/engagements/new");
    await expect(page).toHaveURL("/engagements/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  // reimbursements
  test("reimbursements index", async ({ page, makeAxeBuilder }) => {
    await page.goto("/reimbursements");
    await expect(page).toHaveURL("/reimbursements");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("reimbursement create", async ({ page, makeAxeBuilder }) => {
    await page.goto("/reimbursements/new");
    await expect(page).toHaveURL("/reimbursements/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  // users
  test("users index", async ({ page, makeAxeBuilder }) => {
    await page.goto("/users");
    await expect(page).toHaveURL("/users");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("user create", async ({ page, makeAxeBuilder }) => {
    await page.goto("/users/new");
    await expect(page).toHaveURL("/users/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("add income", async ({ page, makeAxeBuilder }) => {
    await page.goto("/income/new");
    await expect(page).toHaveURL("/income/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("add expense", async ({ page, makeAxeBuilder }) => {
    await page.goto("/expense/new");
    await expect(page).toHaveURL("/expense/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("add transfer", async ({ page, makeAxeBuilder }) => {
    await page.goto("/transfer/new");
    await expect(page).toHaveURL("/transfer/new");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
