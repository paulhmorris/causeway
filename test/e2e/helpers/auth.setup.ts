import { test as setup } from "@playwright/test";

import { createAdmin } from "test/e2e/helpers/auth";

const authFile = `${process.cwd()}/playwright/.auth/admin.json`;

setup("authenticate as admin", async ({ page }) => {
  // Create admin
  const user = await createAdmin();
  console.info(`Admin created: ${user.username}`);

  // Login as admin
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.username);
  await page.waitForURL(/factor-one/i);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /continue/i }).click();

  await page.waitForURL(/dashboards/i);
  await page.context().storageState({ path: authFile });
});
