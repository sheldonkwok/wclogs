import { test, expect } from "@playwright/test";

test("homepage renders API time", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  // Astro 6 dev toolbar emits internal aria-query errors — ignore those
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("%cAstro")) {
      consoleErrors.push(msg.text());
    }
  });

  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.failure()?.errorText} ${req.url()}`);
  });

  await page.goto("/");
  await expect(page.locator("footer")).toContainText("API time");
  expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toHaveLength(0);
  expect(failedRequests, `Failed requests:\n${failedRequests.join("\n")}`).toHaveLength(0);
});
