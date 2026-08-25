import { describe, expect, it } from "vitest";

import { calculateEstimate } from "./calculate-estimate";
import type { QuickEstimateLeadDraft } from "../types/lead-submission";
import {
  completeQuickEstimateSubmission,
  createInitialSubmissionState,
  resetQuickEstimateSubmission,
  retryQuickEstimateSubmission,
  startQuickEstimateSubmission,
} from "./submission-state";

const REQUEST_ID = "0fca3874-40bc-4ea9-a7ad-742a062736ea";
const LEAD_ID = "4d95c6c8-0217-44c7-9d84-e81842721767";
const REQUEST_ID_SOURCE = { randomUUID: () => REQUEST_ID };

function createDraft(): QuickEstimateLeadDraft {
  const estimate = calculateEstimate({
    industryCode: "J",
    employeeCount: 10,
    randomUpliftBps: 200,
  });

  if (estimate.status !== "calculated") {
    throw new Error("유효한 테스트 견적을 생성하지 못했습니다.");
  }

  return {
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
}

function createSubmittingState() {
  return startQuickEstimateSubmission(
    createInitialSubmissionState(),
    createDraft(),
    REQUEST_ID_SOURCE,
  );
}

describe("quick estimate submission state", () => {
  it("제출 시작 시 request_id와 계산 결과를 payload에 고정한다", () => {
    expect(createSubmittingState()).toMatchObject({
      status: "submitting",
      payload: {
        requestId: REQUEST_ID,
        estimate: {
          amount: 1_270_000,
          randomUpliftBps: 200,
        },
      },
    });
  });

  it("제출 중 다시 시작해도 새 request_id나 요청을 만들지 않는다", () => {
    const submitting = createSubmittingState();

    expect(
      startQuickEstimateSubmission(submitting, createDraft(), {
        randomUUID: () => "f7258fe7-4319-4f0c-8c2b-dc0950282a45",
      }),
    ).toBe(submitting);
  });

  it("브라우저 검증 실패는 전송 payload 없이 초안과 오류를 보존한다", () => {
    const draft = createDraft();
    draft.privacyAgreed = false;

    expect(
      startQuickEstimateSubmission(createInitialSubmissionState(), draft, REQUEST_ID_SOURCE),
    ).toEqual({
      status: "failed",
      phase: "validation",
      draft,
      issues: ["privacy_consent_required"],
    });
  });

  it("확인된 성공 body에서만 succeeded로 전환한다", () => {
    const submitting = createSubmittingState();
    const succeeded = completeQuickEstimateSubmission(submitting, {
      ok: true,
      leadId: LEAD_ID,
      duplicate: false,
    });

    expect(succeeded).toMatchObject({
      status: "succeeded",
      leadId: LEAD_ID,
      duplicate: false,
      payload: { requestId: REQUEST_ID },
    });
    expect(startQuickEstimateSubmission(succeeded, createDraft(), REQUEST_ID_SOURCE)).toBe(
      succeeded,
    );
  });

  it.each([
    { ok: false, kind: "validation", code: "INVALID_INPUT" },
    { ok: false, kind: "server", code: "RATE_LIMITED" },
    { ok: false, kind: "server", code: "STORAGE_UNAVAILABLE" },
    { ok: false, kind: "timeout" },
    { ok: false, kind: "network" },
    { ok: false, kind: "unreadable_response" },
  ] as const)("%o 결과를 failed 상태로 보존한다", (failure) => {
    const failed = completeQuickEstimateSubmission(createSubmittingState(), failure);

    expect(failed).toMatchObject({
      status: "failed",
      phase: "submission",
      failure,
      payload: { requestId: REQUEST_ID },
    });
  });

  it("실패 재시도는 request_id, 금액과 난수를 포함한 같은 payload를 재사용한다", () => {
    const submitting = createSubmittingState();
    const failed = completeQuickEstimateSubmission(submitting, {
      ok: false,
      kind: "timeout",
    });
    const retried = retryQuickEstimateSubmission(failed);

    expect(retried).toEqual({
      status: "submitting",
      payload: submitting.status === "submitting" ? submitting.payload : undefined,
    });
    expect(retried.status === "submitting" && submitting.status === "submitting").toBe(true);

    if (retried.status === "submitting" && submitting.status === "submitting") {
      expect(retried.payload).toBe(submitting.payload);
    }
  });

  it("명시적으로 초기화한 경우에만 새 제출을 시작할 수 있다", () => {
    const submitting = createSubmittingState();
    const succeeded = completeQuickEstimateSubmission(submitting, {
      ok: true,
      leadId: LEAD_ID,
      duplicate: false,
    });

    expect(resetQuickEstimateSubmission(submitting)).toBe(submitting);
    expect(resetQuickEstimateSubmission(succeeded)).toEqual({ status: "idle" });
  });
});
