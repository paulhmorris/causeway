import { expect, Page } from "@playwright/test";

type Options = {
  expectedMessage?: string | RegExp;
  expectedType?: "success" | "error" | "info" | "warning";
};

export async function expectVisibleNotification(page: Page, options: Options = {}) {
  const notification = page.getByRole("region", { name: /notifications/i }).getByRole("listitem");
  await expect(notification).toBeVisible();

  if (options.expectedMessage) {
    await expect(notification).toHaveText(options.expectedMessage);
  }
  if (options.expectedType) {
    await expect(notification).toHaveAttribute("data-type", options.expectedType);
  }
}
