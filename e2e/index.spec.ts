import { test, expect } from "@playwright/test";

test("homepage renders API time", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("footer")).toContainText("API time");
});
