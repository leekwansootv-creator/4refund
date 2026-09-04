import { expect, test } from "@playwright/test";

test("루트 첫 section은 간단 견적 hero와 한 벌의 환급 사례를 조합한다", async ({ page }) => {
  await page.goto("/");

  const main = page.locator("main");
  const firstSection = main.locator(":scope > section").first();
  const action = firstSection.getByRole("button", { name: "환급액 조회하기" });

  await expect(
    firstSection.getByRole("heading", {
      level: 1,
      name: "기업의 4대보험 환급을 함께합니다.",
    }),
  ).toBeVisible();
  await expect(main.getByRole("region", { name: "환급 사례 자동 이동 목록" })).toHaveCount(1);
  await expect(action).toBeVisible();

  await action.click();
  await expect(page.getByRole("dialog", { name: "예상 환급액 조회" })).toBeVisible();
});

test("헤더는 Figma의 컬러 워드마크를 고유 비율로 표시한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const logo = page.getByRole("img", { name: "포리펀 4REFUND" });
  const logoSrc = await logo.getAttribute("src");

  await expect(logo).toBeVisible();
  expect(logoSrc).toMatch(/\/assets\/landing\/icons\/header-logo\.svg$/u);
  await expect
    .poll(async () => logo.evaluate((image) => [image.clientWidth, image.clientHeight]))
    .toEqual([136, 40]);
});

test("푸터는 Figma의 회색 워드마크를 고유 비율로 표시한다", async ({ page }) => {
  await page.goto("/");

  const logo = page.locator("footer img[src$='/assets/landing/icons/footer-logo.svg']");

  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toBeVisible();
  await expect
    .poll(async () => logo.evaluate((image) => [image.clientWidth, image.clientHeight]))
    .toEqual([136, 40]);
});

test("푸터는 상담 번호와 구분한 회사 전화 및 팩스 정보를 표시한다", async ({ page }) => {
  await page.goto("/");

  const footer = page.locator("footer");
  const companyPhone = footer.getByRole("link", { name: "회사 대표전화 02-3463-5119" });
  const companyFax = footer.getByText("02-3462-5119", { exact: true });
  const faxIcon = footer.locator("img[src$='/assets/landing/icons/fax.svg']");

  await expect(page.locator("header a[href='tel:01022250555']")).toBeVisible();
  await expect(companyPhone).toHaveAttribute("href", "tel:0234635119");
  await expect(companyPhone).toContainText("02-3463-5119");
  await expect(companyFax).toContainText("02-3462-5119");
  await expect(faxIcon).toBeVisible();
  await expect(footer.locator("a[href='tel:01022250555']")).toHaveCount(0);
});

test("센터 구성원은 이름별 프로필 사진을 여섯 칸 구조에 표시한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const memberList = page.locator("#about ul").first();
  const profileImages = memberList.locator("img[src*='/assets/landing/images/']");
  const expectedImageNames = [
    "center-director.png",
    "center-member-kim-min-han.jpg",
    "center-member-park-seol-young.jpg",
    "center-member-kim-sang-jae.jpg",
    "center-member-lee-jeong-gye.png",
  ];

  await expect(memberList.locator("li")).toHaveCount(6);
  await expect(profileImages).toHaveCount(5);

  for (const imageName of expectedImageNames) {
    const profileImage = memberList.locator(`img[src$='/${imageName}']`);

    await expect(profileImage).toBeVisible();
    await expect
      .poll(() =>
        profileImage.evaluate((image) => {
          const element = image as HTMLImageElement;
          const slot = element.parentElement;
          const slotRect = slot?.getBoundingClientRect();
          const transform = getComputedStyle(element).transform;
          const transformValues = transform.startsWith("matrix(")
            ? transform
                .slice(7, -1)
                .split(",")
                .map((value) => Number(value.trim()))
            : [];

          return {
            complete: element.complete,
            isCropped: transform !== "none",
            isRepositioned: (transformValues[4] ?? 0) !== 0 || (transformValues[5] ?? 0) !== 0,
            isRound: slot ? getComputedStyle(slot).borderRadius !== "0px" : false,
            naturalWidth: element.naturalWidth,
            objectFit: getComputedStyle(element).objectFit,
            slotHeight: Math.round(slotRect?.height ?? 0),
            slotWidth: Math.round(slotRect?.width ?? 0),
          };
        }),
      )
      .toEqual({
        complete: true,
        isCropped: true,
        isRepositioned: true,
        isRound: true,
        naturalWidth: expect.any(Number),
        objectFit: "cover",
        slotHeight: 139,
        slotWidth: 139,
      });
    expect(
      await profileImage.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
  }
});

test("센터장 소개는 이관수 센터장의 소속을 정확히 표시한다", async ({ page }) => {
  await page.goto("/");

  const aboutSection = page.locator("#about");

  await expect(
    aboutSection.getByText("서경대 공공정책센터 연구교수", { exact: true }),
  ).toBeVisible();
  await expect(aboutSection.getByText("서경대 연구교수", { exact: true })).toHaveCount(0);
});

test("브라우저 탭은 헤더 심볼 SVG를 파비콘으로 사용한다", async ({ page, request }) => {
  await page.goto("/");

  const iconHref = await page.locator("link[rel='icon']").getAttribute("href");

  expect(iconHref).not.toBeNull();

  const iconUrl = new URL(iconHref ?? "", page.url());
  const iconResponse = await request.get(iconUrl.toString());

  expect(iconUrl.pathname).toMatch(/\/assets\/landing\/icons\/favicon\.svg$/u);
  expect(iconResponse.ok()).toBe(true);
  expect(iconResponse.headers()["content-type"]).toContain("image/svg+xml");
});

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
  const header = page.getByRole("banner");
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

test.describe("모바일 환급 사례", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("자동 이동하며 목록 위에서 시작한 세로 터치 스크롤을 방해하지 않는다", async ({ page }) => {
    await page.goto("/");

    const viewport = page.getByRole("region", { name: "환급 사례 자동 이동 목록" });
    const track = viewport.locator(":scope > div");

    await viewport.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect(viewport).toBeVisible();
    await expect
      .poll(() =>
        viewport.evaluate((element) => {
          const style = getComputedStyle(element);

          return {
            overflowX: style.overflowX,
            touchAction: style.touchAction,
          };
        }),
      )
      .toEqual({ overflowX: "hidden", touchAction: "pan-y pinch-zoom" });
    await expect
      .poll(() => track.evaluate((element) => getComputedStyle(element).animationPlayState))
      .toBe("running");

    const initialTransform = await track.evaluate((element) => getComputedStyle(element).transform);

    await expect
      .poll(() => track.evaluate((element) => getComputedStyle(element).transform))
      .not.toBe(initialTransform);

    const touchStart = await viewport.evaluate((element) => {
      const bounds = element.getBoundingClientRect();

      return {
        x: Math.round(bounds.left + bounds.width / 2),
        y: Math.round(bounds.top + bounds.height / 2),
      };
    });
    const initialPageScroll = await page.evaluate(() => window.scrollY);
    const initialListScroll = await viewport.evaluate((element) => element.scrollLeft);
    const session = await page.context().newCDPSession(page);

    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [touchStart],
      type: "touchStart",
    });
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x: touchStart.x, y: touchStart.y - 120 }],
      type: "touchMove",
    });
    await session.send("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialPageScroll);
    await expect(viewport).toHaveJSProperty("scrollLeft", initialListScroll);
  });
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
