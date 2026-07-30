import { expect, test } from "@playwright/test";

test("데스크톱 헤더 연락 버튼은 같은 폭과 좌우 여백을 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const phoneAction = page.locator("header a[href^='tel:']");
  const contactAction = page.locator("header a[href='#contact']");
  const [phoneBox, contactBox] = await Promise.all([
    phoneAction.boundingBox(),
    contactAction.boundingBox(),
  ]);
  const phoneLabelGaps = await phoneAction
    .locator("span")
    .last()
    .evaluate((label) => {
      const actionRect = label.closest("a")?.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();

      return {
        left: actionRect ? labelRect.left - actionRect.left : 0,
        right: actionRect ? actionRect.right - labelRect.right : 0,
      };
    });

  expect(phoneBox).not.toBeNull();
  expect(contactBox).not.toBeNull();
  expect(phoneBox?.width).toBe(contactBox?.width);
  expect(phoneLabelGaps.left).toBeGreaterThanOrEqual(18);
  expect(phoneLabelGaps.right).toBeGreaterThanOrEqual(18);
});

test("헤더 메뉴는 목적지까지 600ms 동안 중간 위치를 거쳐 이동한다", async ({ page }) => {
  await page.goto("/");

  const services = page.locator("#services");
  const header = page.locator("header");
  const targetScrollTop = await services.evaluate(
    (target, headerHeight) =>
      target.getBoundingClientRect().top + window.scrollY - Number(headerHeight) - 1,
    await header.evaluate((element) => element.getBoundingClientRect().height),
  );

  await page.getByRole("link", { name: "주요 서비스" }).click();
  await page.waitForTimeout(120);

  const intermediateScrollTop = await page.evaluate(() => window.scrollY);

  expect(intermediateScrollTop).toBeGreaterThan(0);
  expect(intermediateScrollTop).toBeLessThan(targetScrollTop);
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - targetScrollTop) < 1, {
      timeout: 1500,
    })
    .toBe(true);
  await expect(page).toHaveURL(/#services$/u);
});

test("서비스 선택은 자동 순환하며 사용자 호버 인덱스부터 다시 이어진다", async ({ page }) => {
  await page.goto("/");

  const section = page.locator("#services");
  const buttons = section.getByRole("button");

  await section.scrollIntoViewIfNeeded();
  await expect(buttons.nth(0)).toHaveAttribute("aria-expanded", "true");
  await expect(buttons.nth(1)).toHaveAttribute("aria-expanded", "true", { timeout: 2200 });

  await buttons.nth(3).hover();
  await expect(buttons.nth(3)).toHaveAttribute("aria-expanded", "true");
  await page.mouse.move(0, 0);
  await expect(buttons.nth(3)).toHaveAttribute("aria-expanded", "true");
  await expect(buttons.nth(0)).toHaveAttribute("aria-expanded", "true", { timeout: 2200 });
});

test("전문가 강점은 화면에서 사라진 뒤 다시 진입하면 양옆 진입 모션을 재생한다", async ({
  page,
}) => {
  await page.goto("/");

  const repeatReveal = page.locator("#strengths [data-landing-reveal-repeat='true']").first();

  await repeatReveal.scrollIntoViewIfNeeded();
  await expect(repeatReveal).toHaveAttribute("data-landing-revealed", "true");

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await expect(repeatReveal).not.toHaveAttribute("data-landing-revealed", "true");

  await repeatReveal.scrollIntoViewIfNeeded();
  await expect(repeatReveal).toHaveAttribute("data-landing-revealed", "true");
});

test("환급 절차 선택 모션과 문의 카드 호버가 반복 설정을 유지한다", async ({ page }) => {
  await page.goto("/");

  const processCards = page.locator("#process ol > li");
  const animationSettings = await processCards.evaluateAll((cards) =>
    cards.map((card) => {
      const style = getComputedStyle(card);

      return {
        duration: style.animationDuration,
        iterationCount: style.animationIterationCount,
      };
    }),
  );

  expect(animationSettings).toHaveLength(4);
  expect(animationSettings).toEqual(
    Array.from({ length: 4 }, () => ({ duration: "8s", iterationCount: "infinite" })),
  );

  const emailCard = page.locator("#contact a[href^='mailto:']");
  const arrow = emailCard.locator("img").last();

  await emailCard.hover();
  await expect
    .poll(() =>
      emailCard.evaluate((element) => {
        const style = getComputedStyle(element);

        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
          duration: style.transitionDuration,
        };
      }),
    )
    .toEqual({
      backgroundColor: "rgb(36, 36, 46)",
      borderColor: "rgb(102, 102, 122)",
      boxShadow: "rgba(102, 115, 153, 0.25) 0px 2px 6px 0px",
      duration: "0.2s, 0.2s, 0.2s",
    });
  await expect
    .poll(() => arrow.evaluate((element) => getComputedStyle(element).translate))
    .toBe("2px -2px");
});
