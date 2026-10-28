import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

for (const width of [375, 768, 1280, 1920]) {
  test(`${width}px 개편 영역은 문구·이미지·조회 계약을 보존한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    const posts: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") {
        posts.push(route.request().url());
        return route.abort();
      }
      return route.fallback();
    });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#about").getByRole("article")).toHaveCount(2);
    const credentialLines = await page
      .getByRole("article", { name: "부센터장 박진석" })
      .locator("li")
      .evaluateAll((items) =>
        items.map((item) => {
          const range = document.createRange();
          range.selectNodeContents(item);
          return range.getClientRects().length;
        }),
      );
    expect(credentialLines).toEqual([1, 1, 1, 1, 1, 1, 1]);
    if (width >= 1280) {
      const deputySpacing = await page
        .getByRole("article", { name: "부센터장 박진석" })
        .evaluate((profile) => {
          const frame = profile.getBoundingClientRect();
          const name = profile.querySelector("p")!.getBoundingClientRect();
          const photo = profile.querySelector('[data-crop="deputy"]')!.getBoundingClientRect();
          const credentials = profile.querySelectorAll("li");
          return {
            nameInset: name.left - frame.left,
            photoInset: frame.right - photo.right,
            columnDistance:
              credentials[4]!.getBoundingClientRect().left -
              credentials[0]!.getBoundingClientRect().left,
          };
        });
      // 보존 시안의 좌우 155px, 경력 열 356px + 간격 32px를 한 줄 표시와 함께 보존한다.
      expect(deputySpacing).toEqual({ nameInset: 155, photoInset: 155, columnDistance: 388 });
    }
    await expect(
      page.getByRole("heading", { name: "국내 최초 자동화 인공지능 프로그램 구축" }),
    ).toBeVisible();
    await expect(page.getByText("특허 출원 중", { exact: true })).toBeVisible();
    await expect(page.locator("footer")).toContainText("© 2026 포리펀.");
    // 공개 피드 0건이면 시안의 예시 기사나 빈 영역을 게시하지 않는다.
    await expect(page.locator("#news")).toHaveCount(0);
    await expect(page.getByText("성공 보수형 수수료", { exact: true })).toHaveCount(0);
    for (const image of await page.locator("#about img, #strengths img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    const accessibility = await new AxeBuilder({ page })
      .include("#about")
      .include("#strengths")
      .include("footer")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    if (width === 1920) {
      expect(
        await page
          .locator("#expert-strengths-heading")
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toBe("64px");
      expect(
        await page
          .locator("main > section")
          .first()
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toBe(891);
    }
    await page.getByRole("button", { name: "환급액 조회하기" }).click();
    await page.getByLabel("업종").selectOption("N");
    await page.getByLabel("직원 수").fill("25");
    await expect(page.getByLabel("회사명")).toHaveCount(0);
    await page.getByRole("button", { name: "조회하기", exact: true }).click();
    await expect(page.getByRole("region", { name: "간단 견적 조회 결과" })).toBeFocused();
    await page.getByRole("button", { name: "다시 조회하기" }).click();
    await page.getByRole("button", { name: "조회하기", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "환급액 조회하기" })).toBeFocused();
    expect(posts).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("전문가 도입 이미지는 해시 진입·재진입 후 움직이고 reduced motion에서는 멈춘다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#strengths");
  const figure = page.locator("#strengths > div figure");
  const artwork = figure.locator("[data-landing-reveal-followup-target]");
  await expect(artwork).toHaveAttribute("data-landing-reveal-followup-active", "true");
  const initialTransform = await artwork.evaluate((element) => getComputedStyle(element).transform);
  await expect
    .poll(() => artwork.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initialTransform);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(artwork).not.toHaveAttribute("data-landing-reveal-followup-active", "true");
  await figure.scrollIntoViewIfNeeded();
  await expect(artwork).toHaveAttribute("data-landing-reveal-followup-active", "true");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await artwork.evaluate((element) => ({
      animation: getComputedStyle(element).animationName,
      transform: getComputedStyle(element).transform,
    })),
  ).toEqual({ animation: "none", transform: "none" });
});
