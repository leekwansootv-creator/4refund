import { test as base, expect } from "@playwright/test";

// 모든 일반 E2E는 가짜 공급 주소를 가로챈다. Google 운영 시스템으로 요청하지 않는다.
export const test = base.extend({
  context: async ({ context }, provideContext) => {
    await context.route(
      "https://script.google.com/macros/s/NEWS-E2E-INTERCEPT-ONLY/exec?view=news",
      (route) => route.fulfill({ contentType: "application/json", body: '{"articles":[]}' }),
    );
    await provideContext(context);
  },
});
export { expect };
export type { Page, FrameLocator } from "@playwright/test";
