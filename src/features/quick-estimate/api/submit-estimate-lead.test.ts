import { afterEach, describe, expect, it, vi } from "vitest";

import { calculateEstimate } from "../lib/calculate-estimate";
import { createQuickEstimateSubmissionPayload } from "../schemas/lead-submission";
import type {
  QuickEstimateLeadDraft,
  QuickEstimateSubmissionPayload,
} from "../types/lead-submission";
import { submitEstimateLead, type EstimateLeadFetch } from "./submit-estimate-lead";

const ENDPOINT = "https://script.google.com/macros/s/test-deployment/exec";
const REQUEST_ID = "0fca3874-40bc-4ea9-a7ad-742a062736ea";
const LEAD_ID = "4d95c6c8-0217-44c7-9d84-e81842721767";

function createPayload(): QuickEstimateSubmissionPayload {
  const estimate = calculateEstimate({
    industryCode: "software_it",
    employeeCount: 10,
    randomUpliftBps: 200,
  });

  if (estimate.status !== "calculated") {
    throw new Error("유효한 테스트 견적을 생성하지 못했습니다.");
  }

  const draft: QuickEstimateLeadDraft = {
    estimate,
    lead: {
      companyName: "테스트 주식회사",
      contactName: "테스트 담당자",
      email: "test@example.com",
      phone: "01000000000",
    },
    privacyAgreed: true,
    marketing: { agreed: false, channels: [] },
    antiSpam: { honeypot: "", elapsedMs: 5_000 },
  };
  const result = createQuickEstimateSubmissionPayload(draft, REQUEST_ID);

  if (!result.ok) {
    throw new Error("유효한 테스트 payload를 생성하지 못했습니다.");
  }

  return result.payload;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("submitEstimateLead", () => {
  it("form encoded 요청과 redirect·credential 계약을 적용하고 성공 body를 반환한다", async () => {
    const fetcher = vi.fn<EstimateLeadFetch>(async () =>
      jsonResponse({ ok: true, leadId: LEAD_ID, duplicate: false }),
    );
    const payload = createPayload();

    await expect(submitEstimateLead(payload, { endpoint: ENDPOINT, fetcher })).resolves.toEqual({
      ok: true,
      leadId: LEAD_ID,
      duplicate: false,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(ENDPOINT);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "follow",
    });
    expect(init?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    });
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    expect((init?.body as URLSearchParams).get("payload")).toBe(JSON.stringify(payload));
  });

  it.each([
    ["INVALID_INPUT", "validation"],
    ["INVALID_CONSENT", "validation"],
    ["UNSUPPORTED_RULE", "validation"],
    ["RATE_LIMITED", "server"],
    ["STORAGE_UNAVAILABLE", "server"],
    ["INTERNAL_ERROR", "server"],
  ] as const)("공개 실패 코드 %s를 %s 실패로 분류한다", async (code, kind) => {
    const fetcher = vi.fn(async () => jsonResponse({ ok: false, code }));

    await expect(
      submitEstimateLead(createPayload(), { endpoint: ENDPOINT, fetcher }),
    ).resolves.toEqual({ ok: false, kind, code });
  });

  it.each([
    new Response("<html>error</html>", { status: 404 }),
    jsonResponse({ ok: true, leadId: LEAD_ID, duplicate: false }, 500),
    jsonResponse({ ok: false, code: "UNKNOWN_ERROR" }),
    jsonResponse({ ok: true, leadId: "invalid", duplicate: false }),
    jsonResponse({ ok: true, leadId: LEAD_ID, duplicate: false, extra: true }),
  ])("읽을 수 없거나 계약에 없는 응답을 성공으로 처리하지 않는다", async (response) => {
    const fetcher = vi.fn(async () => response);

    await expect(
      submitEstimateLead(createPayload(), { endpoint: ENDPOINT, fetcher }),
    ).resolves.toEqual({ ok: false, kind: "unreadable_response" });
  });

  it("fetch 실패를 저장 여부가 불명인 network 실패로 반환한다", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      submitEstimateLead(createPayload(), { endpoint: ENDPOINT, fetcher }),
    ).resolves.toEqual({ ok: false, kind: "network" });
  });

  it("제한 시간을 넘으면 요청을 중단하고 timeout으로 반환한다", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const submission = submitEstimateLead(createPayload(), {
      endpoint: ENDPOINT,
      fetcher,
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(submission).resolves.toEqual({ ok: false, kind: "timeout" });
  });

  it("응답 body를 읽는 중 제한 시간을 넘겨도 timeout으로 반환한다", async () => {
    vi.useFakeTimers();
    const response = new Response(null, { status: 200 });
    const fetcher = vi.fn<EstimateLeadFetch>(async (...args) => {
      const signal = args[1]?.signal;

      vi.spyOn(response, "json").mockImplementation(
        () =>
          new Promise<never>((_resolve, reject) => {
            signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      );

      return response;
    });
    const submission = submitEstimateLead(createPayload(), {
      endpoint: ENDPOINT,
      fetcher,
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(submission).resolves.toEqual({ ok: false, kind: "timeout" });
  });
});
