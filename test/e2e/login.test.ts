import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test"; // unauthenticated test

test.describe("Login Page", () => {
  test("should not login with invalid credentials", async ({ page }) => {
    const randomUser = {
      email: faker.internet.email().toLowerCase(),
      password: faker.internet.password().toLowerCase(),
    };
    await page.goto("/login");
    const email = page.getByRole("textbox", { name: "Email" });
    const password = page.getByRole("textbox", { name: "Password" });
    await email.fill(randomUser.email);
    await password.fill(randomUser.password);
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(email).toBeFocused();
    await expect(password).not.toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
  });

  test("should not login with empty credentials", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByRole("textbox", { name: "Email" });
    await email.clear();
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL("/login");
    await expect(email).toBeFocused();
  });
});
