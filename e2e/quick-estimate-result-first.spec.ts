import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { QuickEstimateSubmissionPayload } from "../src/features/quick-estimate";

const SUCCESS = { ok: true, leadId: "4d95c6c8-0217-44c7-9d84-e81842721767", duplicate: false };

async function openResult(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "환급액 조회하기" }).click();
  await expect(page.getByLabel("업종")).toBeFocused();
  await expect(page.getByLabel("회사명")).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByLabel("업종").selectOption("N");
  await page.getByLabel("직원 수").fill("25");
  await page.getByRole("button", { name: "조회하기", exact: true }).click();
  await expect(page.getByRole("region", { name: "간단 견적 조회 결과" })).toBeFocused();
}
async function fillApplication(page: Page, marketing = false) {
  await page.getByRole("button", { name: "상세 견적 받기" }).click();
  await expect(page.getByLabel("회사명")).toBeFocused();
  await page.getByLabel("회사명").fill("검증 삭제대상");
  await page.getByLabel("담당자 이름").fill("테스트");
  await page.getByLabel("이메일").fill("qa@example.test");
  await page.getByLabel("전화번호").fill("01000000000");
  await expect(page.getByRole("button", { name: "상세 견적 신청하기" })).toBeDisabled();
  await page.getByLabel("개인정보 처리 동의 (필수)").check();
  if (marketing) await page.getByLabel("마케팅 활용 동의 (선택)").check();
}
async function expectAccessible(page: Page) {
  const scan = await new AxeBuilder({ page })
    .include("dialog")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
}

for (const width of [1440, 375]) {
  test(`${width}px 선조회와 최종 신청 경계·동의·완료를 외부 저장 없이 검증한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: QuickEstimateSubmissionPayload[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      requests.push(
        JSON.parse(
          new URLSearchParams(route.request().postData() ?? "").get("payload") ?? "null",
        ) as QuickEstimateSubmissionPayload,
      );
      await route.fulfill({ json: SUCCESS });
    });
    await openResult(page);
    await expectAccessible(page);
    const amount = await page.getByText(/^[\d,]+원$/u).textContent();
    expect(requests).toHaveLength(0);
    await fillApplication(page, width === 375);
    await page.getByRole("button", { name: "[보기]", exact: true }).first().click();
    await expect(page.getByText("보유 기간: 접수일부터 1년")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "결과로 돌아가기" }).click();
    await page.getByRole("button", { name: "상세 견적 받기" }).click();
    await expect(page.getByLabel("회사명")).toHaveValue("검증 삭제대상");
    expect(requests).toHaveLength(0);
    await page.waitForTimeout(3_100);
    await page.getByRole("button", { name: "상세 견적 신청하기" }).click();
    await expect(page.getByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
    await expectAccessible(page);
    expect(requests).toHaveLength(1);
    expect(`${requests[0]?.estimate.amount.toLocaleString("ko-KR")}원`).toBe(amount);
    expect(requests[0]?.marketing.agreed).toBe(width === 375);
    expect(requests[0]?.estimate.ruleVersion).toBe("estimate-rule-2026-08-25");
    await expect(page.getByRole("button", { name: "상세 견적 신청하기" })).toHaveCount(0);
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.getByRole("button", { name: "환급액 조회하기" })).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test("조회와 재조회 뒤 닫기는 POST를 생성하지 않는다", async ({ page }) => {
  let posts = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await route.abort();
    } else await route.continue();
  });
  await openResult(page);
  await page.getByRole("button", { name: "다시 조회하기" }).click();
  await expect(page.getByLabel("직원 수")).toHaveValue("25");
  await page.getByLabel("직원 수").fill("30");
  await page.getByRole("button", { name: "조회하기", exact: true }).click();
  await page.getByRole("button", { name: "간단 견적 닫기" }).click();
  expect(posts).toBe(0);
});

test("판독 불가 응답은 경고·동일 payload 재시도 뒤 중복 성공으로 완료한다", async ({ page }) => {
  const bodies: string[] = [];
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData() ?? "");
    await route.fulfill(
      bodies.length === 1
        ? { body: "not-json", contentType: "text/plain" }
        : { json: { ...SUCCESS, duplicate: true } },
    );
  });
  await openResult(page);
  await fillApplication(page);
  await page.waitForTimeout(3_100);
  await page.getByRole("button", { name: "상세 견적 신청하기" }).click();
  await expect(page.getByText(/접수 결과를 확인하지 못했습니다/)).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "중복 접수될 수 있습니다",
  );
  await page.getByRole("button", { name: "돌아가서 접수 확인" }).click();
  await page.getByRole("button", { name: "접수 다시 시도" }).click();
  await expect(page.getByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
});

for (const scenario of [
  { width: 1440, zoom: 2 },
  { width: 375, zoom: 1 },
]) {
  test(`${scenario.width}px ${scenario.zoom * 100}% 확대·키보드·동의 전문·reduced motion`, async ({
    page,
  }) => {
    // 브라우저 200% 확대와 같은 CSS 가용 영역을 사용한다. CSS zoom은 vh를 줄이지 않는다.
    await page.setViewportSize({
      width: scenario.width / scenario.zoom,
      height: 900 / scenario.zoom,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let posts = 0;
    await page.route("**/*", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        await route.abort();
      } else await route.continue();
    });
    await page.goto("/");
    const action = page.getByRole("button", { name: "환급액 조회하기" });
    await action.click();
    await expect(page.getByLabel("업종")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("직원 수")).toBeFocused();
    await expectAccessible(page);
    await page.getByLabel("업종").selectOption("N");
    await page.getByLabel("직원 수").fill("6000");
    await page.getByRole("button", { name: "조회하기", exact: true }).click();
    await expectAccessible(page);
    await page.getByRole("button", { name: "상세 견적 받기" }).click();
    // 빈 필드 blur로 오류가 표시되어도 전문 버튼의 첫 클릭을 잃지 않아야 한다.
    await page.getByRole("button", { name: "[보기]", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "[접기]", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "[보기]", exact: true }).click();
    await expect(page.getByText("보유 기간: 접수일부터 1년")).toBeAttached();
    await expect(page.getByText("이용 채널: 이메일, 문자(SMS)")).toBeAttached();
    await expectAccessible(page);
    const back = page.getByRole("button", { name: "결과로 돌아가기" });
    await back.focus();
    await expect(back).toBeInViewport();
    await page.keyboard.press("Tab");
    // native dialog는 마지막 요소 뒤 브라우저 chrome으로 이동할 수 있지만 배경 UI는 inert다.
    if (await page.evaluate(() => document.activeElement === document.body)) {
      await page.keyboard.press("Tab");
    }
    await expect(page.getByRole("button", { name: "간단 견적 닫기" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    if (await page.evaluate(() => document.activeElement === document.body)) {
      await page.keyboard.press("Shift+Tab");
    }
    await expect(back).toBeFocused();
    const overflow = await page.getByRole("dialog").evaluate((dialog) => {
      const body = dialog.querySelector<HTMLElement>("[data-dialog-body]");
      return body ? body.scrollWidth > body.clientWidth : true;
    });
    expect(overflow).toBe(false);
    await page.keyboard.press("Escape");
    await expect(action).toBeFocused();
    expect(posts).toBe(0);
  });
}

test("실제 모달은 접수 응답 전 Escape와 닫기를 차단하고 성공 후 복귀한다", async ({ page }) => {
  let finish: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let posts = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    await pending;
    await route.fulfill({ json: SUCCESS });
  });
  await openResult(page);
  await fillApplication(page);
  await page.waitForTimeout(3_100);
  await page.getByRole("button", { name: "상세 견적 신청하기" }).click();
  await expect(page.getByText("상세 견적 신청을 접수하고 있습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "간단 견적 닫기" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("회사명")).toHaveCount(0);
  await expect(page.getByText("상세 견적 신청이 접수되었습니다.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "결과로 돌아가기" })).toHaveCount(0);
  finish?.();
  await expect(page.getByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
  expect(posts).toBe(1);
});
