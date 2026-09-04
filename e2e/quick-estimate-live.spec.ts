import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { recordLiveSubmissionEvidence } from "./quick-estimate-live-evidence";

import {
  submitEstimateLead,
  type QuickEstimateSubmissionPayload,
} from "../src/features/quick-estimate";

const runLiveE2e = process.env.QUICK_ESTIMATE_LIVE_E2E === "1";

// 실제 endpoint와 입력값이 브라우저 캡처·네트워크 trace에 남지 않게 한다.
test.use({ screenshot: "off", video: "off", trace: "off" });

async function openQuickEstimate(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "환급액 조회하기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillContact(page: Page, suffix: string) {
  const phoneSuffix = `${Date.now()}${suffix === "opt-in" ? "1" : "0"}`.slice(-8);

  await page.getByLabel("회사명").fill(`4refund E2E 삭제대상 ${suffix}`);
  await page.getByLabel("담당자 이름").fill("테스트 담당자");
  await page.getByLabel("이메일").fill(`quick-estimate-${suffix}-${Date.now()}@example.test`);
  await page.getByLabel("전화번호").fill(`010${phoneSuffix}`);
}

async function fillEstimate(page: Page, marketingAgreed: boolean) {
  await page.getByLabel("업종").selectOption("N");
  await page.getByLabel("직원 수").fill("25");
  await page.getByRole("button", { name: "조회하기", exact: true }).click();
  const amount = await page.getByText(/^[\d,]+원$/u).textContent();
  await page.getByRole("button", { name: "상세 견적 받기" }).click();
  await page.getByLabel("개인정보 처리 동의 (필수)").check();

  if (marketingAgreed) {
    await page.getByLabel("마케팅 활용 동의 (선택)").check();
  }
  return amount;
}

test.describe("간단 견적 실제 저장 E2E", () => {
  test.skip(!runLiveE2e, "승인된 Apps Script 배포와 테스트 Sheet가 필요합니다.");

  test("데스크톱에서 마케팅 미동의 접수를 저장한다", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openQuickEstimate(page);
    const amount = await fillEstimate(page, false);
    await fillContact(page, "opt-out");
    const requestPromise = page.waitForRequest((request) => request.method() === "POST");
    await page.waitForTimeout(3_100);
    await page.getByRole("button", { name: "상세 견적 신청하기", exact: true }).click();

    await expect(page.getByText("상세 견적 신청이 접수되었습니다.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("region", { name: "상세 견적 접수 상태" })).toBeFocused();
    const request = await requestPromise;
    const payload = JSON.parse(
      new URLSearchParams(request.postData() ?? "").get("payload") ?? "null",
    ) as QuickEstimateSubmissionPayload;
    await recordLiveSubmissionEvidence(payload);
    expect(`${payload.estimate.amount.toLocaleString("ko-KR")}원`).toBe(amount);
    const duplicate = await submitEstimateLead(payload, { endpoint: request.url() });
    expect(duplicate).toMatchObject({ ok: true, duplicate: true });
  });

  test("모바일에서 마케팅 동의 접수를 저장한다", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openQuickEstimate(page);
    const amount = await fillEstimate(page, true);
    await fillContact(page, "opt-in");
    const requestPromise = page.waitForRequest((request) => request.method() === "POST");
    await page.waitForTimeout(3_100);
    await page.getByRole("button", { name: "상세 견적 신청하기", exact: true }).click();

    await expect(page.getByText("상세 견적 신청이 접수되었습니다.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("예상 환급액", { exact: true })).toBeVisible();
    const request = await requestPromise;
    const payload = JSON.parse(
      new URLSearchParams(request.postData() ?? "").get("payload") ?? "null",
    ) as QuickEstimateSubmissionPayload;
    await recordLiveSubmissionEvidence(payload);
    expect(`${payload.estimate.amount.toLocaleString("ko-KR")}원`).toBe(amount);
    expect(payload.marketing.agreed).toBe(true);
  });

  test("키보드와 200% 확대에 대응하는 영역에서도 입력 dialog에 자동 접근성 위반이 없다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 720, height: 450 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openQuickEstimate(page);

    await expect(page.getByLabel("업종")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("직원 수")).toBeFocused();

    const results = await new AxeBuilder({ page })
      .include("dialog")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations).toEqual([]);
    expect(
      await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
  });
});
