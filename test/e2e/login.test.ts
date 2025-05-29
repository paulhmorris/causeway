import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test"; // unauthenticated test

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("should not login with invalid credentials", async ({ page }) => {
    const randomUser = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password().toLowerCase(),
    };
    const email = page.getByRole("textbox", { name: "Email" });
    const password = page.getByRole("textbox", { name: "Password" });
    await email.fill(randomUser.email);
    await password.fill(randomUser.password);
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(email).toBeFocused();
    await expect(password).not.toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
  });

  test("should show error on empty fields", async ({ page }) => {
    const email = page.getByRole("textbox", { name: "Email" });
    await email.clear();
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/required/i)).toBeVisible();

    const password = page.getByRole("textbox", { name: "Password" });
    await password.clear();
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/password must be 8 or more characters/i)).toBeVisible();
  });
});
