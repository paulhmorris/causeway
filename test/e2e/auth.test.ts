import { expect, test } from "@playwright/test";
import { createAdmin, createClerkUser, e2eEmail, signIn } from "test/e2e/helpers/auth";
import prisma from "test/e2e/helpers/db";

import { clerkClient } from "~/integrations/clerk.server";

const signedOut = { cookies: [], origins: [] };

test.describe("Signed out", () => {
  test.use({ storageState: signedOut });

  test("redirects protected pages to sign-in with a return url", async ({ page }) => {
    await page.goto("/accounts");
    await page.waitForURL(/\/sign-in/);

    const redirectUrl = new URL(page.url()).searchParams.get("redirect_url");
    expect(redirectUrl).toMatch(/\/accounts$/);
  });
});

test.describe("Signed in", () => {
  test.use({ storageState: signedOut });

  test("keeps the session when the org cookie is missing", async ({ page, context }) => {
    const user = await createAdmin();
    await signIn(page, user.username);
    await page.goto("/");
    await page.waitForURL(/dashboards\/admin/);

    await context.clearCookies({ name: "__causeway_session" });
    await page.goto("/");
    await expect(page).toHaveURL(/dashboards\/admin/);

    await page.goto("/accounts");
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test("returns to the requested page after choosing an org", async ({ page, context }) => {
    const user = await createAdmin();
    await signIn(page, user.username);
    await context.clearCookies({ name: "__causeway_session" });

    await page.goto("/accounts");
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test("links an invited user on first sign-in", async ({ page }) => {
    const user = await createAdmin({ linked: false });
    await signIn(page, user.username);

    await page.goto("/");
    await page.waitForURL(/dashboards\/admin/);

    const linked = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { clerkId: true } });
    expect(linked.clerkId).toBe(user.clerkUserId);
  });

  test("shows no-access to Clerk users without an account, and lets them sign out", async ({ page }) => {
    const email = e2eEmail("stranger");
    const clerkUser = await createClerkUser(email);

    try {
      await signIn(page, email);
      await page.goto("/");
      await expect(page).toHaveURL(/\/no-access$/);

      await page.getByRole("button", { name: /sign out/i }).click();
      await page.waitForURL(/\/sign-in/);
    } finally {
      await clerkClient.users.deleteUser(clerkUser.id);
    }
  });

  test("logs out from the user menu", async ({ page }) => {
    const user = await createAdmin();
    await signIn(page, user.username);
    await page.goto("/dashboards/admin");

    await page.getByRole("button", { name: /open user menu/i }).click();
    await page.getByRole("menuitem", { name: /log out/i }).click();
    await page.waitForURL(/\/sign-in/);

    await page.goto("/dashboards/admin");
    await page.waitForURL(/\/sign-in/);
  });
});
