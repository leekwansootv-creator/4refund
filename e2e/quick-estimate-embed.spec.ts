import { expect, test, type Page, type FrameLocator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QuickEstimateSubmissionPayload } from "../src/features/quick-estimate";

const widget = "https://widget.example";
const success = { ok: true, leadId: "4d95c6c8-0217-44c7-9d84-e81842721767", duplicate: false };

async function host(
  page: Page,
  origin = "https://partner-a.example",
  extra = "",
  failFrame = false,
) {
  await page.route(`${widget}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (failFrame && url.pathname === "/embed/quick-estimate.html") return route.abort();
    const response = await page.request.get(`http://127.0.0.1:3100${url.pathname}${url.search}`);
    await route.fulfill({ response });
  });
  await page.route(`${origin}/**`, (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="ko"><head><title>제휴 테스트</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}h1{font-size:20px}button{color:red!important;background:lime!important}dialog{display:none!important}iframe{height:1px!important}#wrap{overflow:hidden;transform:translateZ(0);max-width:600px}#estimate{width:100%}</style></head><body><h1>제휴 테스트</h1><button id="outside">부모 버튼</button><div id="wrap"><div id="estimate"><a href="${widget}/embed/quick-estimate.html?mode=standalone">별도 조회</a></div></div><script async src="${widget}/embed/v1/loader.js" data-target="estimate"></script>${extra}<div style="height:1200px">부모 본문</div></body></html>`,
    }),
  );
  await page.goto(origin);
  await expect(page).toHaveTitle("제휴 테스트");
  if (!failFrame)
    await expect(
      page.frameLocator('iframe[title$="진입"]').getByRole("button", { name: "환급액 조회하기" }),
    ).toBeVisible();
}
function flow(page: Page) {
  return page.frameLocator('iframe[title$="상담 신청"]');
}
async function open(page: Page) {
  await page
    .frameLocator('iframe[title$="진입"]')
    .getByRole("button", { name: "환급액 조회하기" })
    .click();
  await expect(flow(page).getByLabel("업종")).toBeFocused();
}
async function lookup(frame: FrameLocator) {
  await frame.getByLabel("업종").selectOption("N");
  await frame.getByLabel("직원 수").fill("25");
  await frame.getByRole("button", { name: "조회하기", exact: true }).click();
  await expect(frame.getByRole("region", { name: "간단 견적 조회 결과" })).toBeFocused();
}
async function apply(frame: FrameLocator) {
  await frame.getByRole("button", { name: "상세 견적 받기" }).click();
  await frame.getByLabel("회사명").fill("모의 회사");
  await frame.getByLabel("담당자 이름").fill("테스트");
  await frame.getByLabel("이메일").fill("qa@example.test");
  await frame.getByLabel("전화번호").fill("01000000000");
  await frame.getByLabel("개인정보 처리 동의 (필수)").check();
}

for (const [origin, width] of [
  ["https://partner-a.example", 1440],
  ["https://partner-b.example", 375],
] as const) {
  test(`${origin} ${width}px 조회 0 POST·출처·재시도·CSS·포커스`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const requests: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      requests.push(route.request().postData() ?? "");
      await route.fulfill(
        requests.length === 1
          ? { contentType: "text/plain", body: "unreadable" }
          : { json: { ...success, duplicate: true } },
      );
    });
    await host(page, origin);
    await page.screenshot({
      path: join(tmpdir(), `4refund-embed-entry-${width}.png`),
      fullPage: false,
    });
    await open(page);
    for (let index = 0; index < 8; index++) await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "부모 버튼" })).not.toBeFocused();
    for (let index = 0; index < 8; index++) await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "부모 버튼" })).not.toBeFocused();
    await lookup(flow(page));
    expect(requests).toHaveLength(0);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    await apply(flow(page));
    await flow(page).getByRole("button", { name: "[보기]", exact: true }).first().click();
    await expect(flow(page).getByText(/출처 정보:/u)).toBeVisible();
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({
      path: join(tmpdir(), `4refund-embed-contact-${width}.png`),
      fullPage: false,
    });
    await page.waitForTimeout(3100);
    await flow(page).getByRole("button", { name: "상세 견적 신청하기" }).click();
    await expect(flow(page).getByText(/접수 결과를 확인하지 못했습니다/u)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(flow(page).getByText(/중복 접수될 수 있습니다/u)).toBeVisible();
    await flow(page).getByRole("button", { name: "돌아가서 접수 확인" }).click();
    await flow(page).getByRole("button", { name: "접수 다시 시도" }).click();
    await expect(flow(page).getByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe(requests[1]);
    const payload = JSON.parse(
      new URLSearchParams(requests[0]).get("payload") ?? "null",
    ) as QuickEstimateSubmissionPayload;
    expect(payload.submissionVersion).toBe(2);
    expect(payload.attribution).toEqual({
      channel: "embed",
      siteOrigin: origin,
      collectionMethod: "parent_message",
    });
    expect(payload.sourcePath).toBe("/");
    await flow(page).getByRole("button", { name: "확인", exact: true }).click();
    await expect(page.locator("dialog")).not.toBeVisible();
    await expect(
      page.frameLocator('iframe[title$="진입"]').getByRole("button", { name: "환급액 조회하기" }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    expect(errors).toEqual([]);
  });
}

test("조회·재조회·닫기와 잘못된 메시지는 저장을 발생시키지 않는다", async ({ page }) => {
  let posts = 0;
  await page.route("**/*", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.abort();
    }
    return route.continue();
  });
  await host(page);
  await open(page);
  await lookup(flow(page));
  await page.evaluate(() =>
    window.postMessage(
      {
        protocol: "fourrefund-embed-v1",
        instanceId: "wrong",
        sessionId: "wrong",
        type: "CLOSE_ALLOWED",
        data: null,
      },
      window.location.origin,
    ),
  );
  await expect(page.locator("dialog")).toBeVisible();
  await flow(page).getByRole("button", { name: "다시 조회하기" }).click();
  await lookup(flow(page));
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
  expect(posts).toBe(0);
});

test("연결 실패는 성공처럼 표시하지 않고 링크와 재진입을 제공한다", async ({ page }) => {
  await host(page, "https://partner-a.example", "", true);
  await expect(page.getByText("조회 화면 연결에 실패했습니다.", { exact: false })).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByRole("link", { name: "별도 페이지에서 예상 환급액 조회하기" }),
  ).toBeVisible();
  expect(await page.locator("dialog[open]").count()).toBe(0);
  // timeout 이후 네트워크가 돌아와도 실패한 세션을 자동으로 다시 열지 않습니다.
  await page.route(`${widget}/embed/quick-estimate.html*`, async (route) => {
    const url = new URL(route.request().url());
    const response = await page.request.get(`http://127.0.0.1:3100${url.pathname}${url.search}`);
    await route.fulfill({ response });
  });
  const entry = page.frames().find((frame) => frame.url().includes("mode=entry"));
  const source = await page.locator('iframe[title$="진입"]').getAttribute("src");
  const target = entry ?? page.frames().find((frame) => frame !== page.mainFrame());
  expect(target).toBeDefined();
  await target!.goto(source!);
  await expect(
    page.getByRole("link", { name: "별도 페이지에서 예상 환급액 조회하기" }),
  ).toBeVisible();
  await expect(page.locator('iframe[title$="진입"]')).not.toBeVisible();
});

test("iframe-only·standalone은 작은 프레임에서 내부 스크롤로 조회하고 출처를 추정하지 않는다", async ({
  page,
}) => {
  let posts = 0;
  await page.route("**/*", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.abort();
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto("/embed/quick-estimate.html?mode=standalone&diagnostic=1");
  await expect(page.getByText(/확인 불가 · unknown/u)).toBeVisible();
  await page.getByRole("button", { name: "환급액 조회하기" }).click();
  await page.getByLabel("업종").selectOption("N");
  await page.getByLabel("직원 수").fill("10");
  await page.getByRole("button", { name: "조회하기", exact: true }).click();
  await expect(page.getByRole("region", { name: "간단 견적 조회 결과" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(posts).toBe(0);
});

test("SPA 중복 mount·unmount와 동시에 하나의 모달을 유지한다", async ({ page }) => {
  await host(page, "https://partner-a.example", `<div id="second" data-diagnostic="1"></div>`);
  await page.evaluate(() => {
    const target = document.getElementById("estimate");
    const second = document.getElementById("second");
    if (target && second) {
      window.FourRefundEmbed?.mount(target);
      window.FourRefundEmbed?.mount(second);
    }
  });
  await expect(page.locator('iframe[title$="진입"]')).toHaveCount(2);
  const diagnostic = page.locator('iframe[title$="진입"]').last().contentFrame();
  await expect(diagnostic.locator("output")).toContainText("준비 완료");
  await expect
    .poll(() =>
      diagnostic.locator("html").evaluate((element) => element.scrollHeight <= window.innerHeight),
    )
    .toBe(true);
  await page
    .locator('iframe[title$="진입"]')
    .first()
    .contentFrame()
    .getByRole("button", { name: "환급액 조회하기" })
    .click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.evaluate(() => {
    const target = document.getElementById("estimate");
    if (target) window.FourRefundEmbed?.mount(target).unmount();
  });
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.evaluate(() => {
    const target = document.getElementById("estimate");
    if (target) window.FourRefundEmbed?.mount(target).unmount();
  });
  await expect(page.locator('iframe[title$="진입"]')).toHaveCount(1);
  // unmount 직후 진행 중인 mock 응답을 마친 뒤 fixture를 닫아 폐기된 응답 경합을 막습니다.
  await page.unrouteAll({ behavior: "wait" });
});

for (const failure of ["network", "timeout", "RATE_LIMITED", "STORAGE_UNAVAILABLE"] as const) {
  test(`외부 ${failure} 실패는 완료로 표시하지 않고 같은 요청을 보존한다`, async ({ page }) => {
    test.setTimeout(45000);
    const bodies: string[] = [];
    await page.route("**/*", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      bodies.push(route.request().postData() ?? "");
      if (bodies.length > 1) return route.fulfill({ json: success });
      if (failure === "network") return route.abort();
      if (failure === "timeout") return;
      return route.fulfill({ json: { ok: false, code: failure } });
    });
    await host(page);
    await open(page);
    await lookup(flow(page));
    await apply(flow(page));
    await page.waitForTimeout(3100);
    await flow(page).getByRole("button", { name: "상세 견적 신청하기" }).click();
    if (failure === "timeout") {
      await expect(flow(page).getByText("상세 견적 신청을 접수하고 있습니다.")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog")).toBeVisible();
      await expect(flow(page).getByRole("button", { name: "간단 견적 닫기" })).toBeDisabled();
    }
    await expect(flow(page).getByRole("button", { name: "접수 다시 시도" })).toBeVisible({
      timeout: 18000,
    });
    await expect(flow(page).getByText("상세 견적 신청이 접수되었습니다.")).toHaveCount(0);
    await flow(page).getByRole("button", { name: "접수 다시 시도" }).click();
    await expect(flow(page).getByText("상세 견적 신청이 접수되었습니다.")).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
  });
}

test("조회 전용 데모는 endpoint가 빌드돼 있어도 접수를 열지 않는다", async ({ page }) => {
  let posts = 0;
  await page.route("**/*", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/embed/demo.html");
  const demo = page.frameLocator('iframe[title="조회 전용 예시"]');
  await demo.getByRole("button", { name: "환급액 조회하기" }).click();
  await lookup(demo);
  await expect(demo.getByRole("button", { name: "상세 견적 받기" })).toHaveCount(0);
  expect(posts).toBe(0);
});

test("리뷰: 준비된 진입 iframe이 다시 로드되면 복구 링크를 표시한다", async ({ page }) => {
  await page.route("**/*", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await host(page);
  const entry = page.frames().find((frame) => frame.url().includes("mode=entry"));
  expect(entry).toBeDefined();
  await entry!.goto(entry!.url());
  await expect(
    page.getByRole("link", { name: "별도 페이지에서 예상 환급액 조회하기" }),
  ).toBeVisible();
  await expect(page.locator('iframe[title$="진입"]')).not.toBeVisible();
});

test("리뷰: standalone 닫기는 편지의 조회 버튼으로 포커스를 돌려준다", async ({ page }) => {
  await page.route("**/*", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.goto("/embed/quick-estimate.html?mode=standalone");
  await page.getByRole("button", { name: "환급액 조회하기" }).click();
  await expect(page.getByLabel("업종")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "환급액 조회하기" })).toBeFocused();
});

test("리뷰: 미확인 신청 뒤 iframe 재로드는 경고를 거쳐 닫고 새 요청을 보내지 않는다", async ({
  page,
}) => {
  let posts = 0;
  await page.route("**/*", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    return route.fulfill({ contentType: "text/plain", body: "unreadable" });
  });
  await host(page);
  await open(page);
  await lookup(flow(page));
  await apply(flow(page));
  await page.waitForTimeout(3100);
  await flow(page).getByRole("button", { name: "상세 견적 신청하기" }).click();
  await expect(flow(page).getByRole("button", { name: "접수 다시 시도" })).toBeVisible();
  const activeFrame = page.frames().find((frame) => frame.url().includes("mode=flow"));
  expect(activeFrame).toBeDefined();
  await activeFrame!.goto(activeFrame!.url());
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("중복 접수");
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "화면 연결이 끊긴 경우 닫기" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "화면 연결이 끊긴 경우 닫기" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(posts).toBe(1);
});
