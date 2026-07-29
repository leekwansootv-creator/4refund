import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("랜딩 페이지에는 WCAG A/AA 자동 검사 위반이 없다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

  expect(results.violations).toEqual([]);
});
