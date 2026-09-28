import { test as setup } from "@playwright/test";
import { createAdmin, signIn } from "test/e2e/helpers/auth";

const authFile = `${process.cwd()}/playwright/.auth/admin.json`;

setup("authenticate as admin", async ({ page }) => {
  const user = await createAdmin();
  console.info(`Admin created: ${user.username}`);

  await signIn(page, user.username);
  await page.goto("/");
  await page.waitForURL(/dashboards/i);
  await page.context().storageState({ path: authFile });
});
