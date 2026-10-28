import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const endpoint = "https://script.google.com/macros/s/NEWS-E2E-INTERCEPT-ONLY/exec?view=news";
function articles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
    title: i === 0 ? "개발 검증용 긴 제목입니다. ".repeat(15) : `개발 검증용 기사 ${i + 1}`,
    url: `https://news.example.org/${i}`,
    imageUrl: i === 1 ? "data:image/jpeg;base64,/9j/AAAA" : null,
  }));
}

for (const width of [375, 768, 1280, 1920]) {
  test(`뉴스 0/1/2/3건, 긴 제목과 이미지 실패, 키보드 접근 ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let count = 0;
    await page.route(endpoint, (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ articles: articles(count) }),
      }),
    );
    await page.goto("/");
    await expect(page.locator("#news")).toHaveCount(0);
    for (count of [1, 2, 3]) {
      await page.reload();
      const section = page.locator("#news");
      await expect(section.locator("li")).toHaveCount(count);
      await section.scrollIntoViewIfNeeded();
      await expect(section.locator("img").last()).toHaveAttribute("src", /article-fallback\.png$/u);
      await expect
        .poll(() =>
          section
            .locator("img")
            .last()
            .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      expect(overflow).toBe(false);
      await section.getByRole("link").first().focus();
      await expect(section.getByRole("link").first()).toBeFocused();
      await expect(section.getByRole("link").first()).toHaveCSS("outline-style", "solid");
      await expect(section.getByRole("link").first()).toHaveCSS("transition-duration", "0s");
    }
    expect((await new AxeBuilder({ page }).include("#news").analyze()).violations).toEqual([]);
    await page.locator("#news").screenshot({ path: info.outputPath(`news-${width}.png`) });
    if (width === 768) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    }
  });
}

test("뉴스 로딩·조회 실패·재시도는 게시 0건과 구분한다", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route(endpoint, async (route) => {
    await gate;
    await route.fulfill({
      contentType: "application/json",
      body: fail ? '{"error":"NEWS_UNAVAILABLE"}' : JSON.stringify({ articles: articles(1) }),
    });
  });
  await page.goto("/");
  await expect(page.locator("#news").getByRole("status")).toBeVisible();
  release();
  await expect(page.locator("#news").getByRole("alert")).toBeVisible();
  fail = false;
  await page.locator("#news").getByRole("button", { name: "다시 시도" }).click();
  await expect(page.locator("#news li")).toHaveCount(1);
});
