import {
  MARKETING_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  calculateEstimate,
} from "@/features/quick-estimate";
import { describe, expect, it, vi } from "vitest";

import { handleQuickEstimatePost } from "./web-app";

const OCCURRED_AT = "2026-08-06T01:02:03.456Z";

function createPayload(): string {
  const estimate = calculateEstimate({
    industryCode: "software_it",
    employeeCount: 10,
    randomUpliftBps: 200,
  });

  if (estimate.status !== "calculated") {
    throw new Error("유효한 테스트 견적을 생성하지 못했습니다.");
  }

  return JSON.stringify({
    requestId: "0fca3874-40bc-4ea9-a7ad-742a062736ea",
    estimate: {
      industryCode: estimate.industryCode,
      employeeCount: estimate.employeeCount,
      amount: estimate.amount,
      currency: estimate.currency,
      randomUpliftBps: estimate.randomUpliftBps,
      ruleVersion: estimate.ruleVersion,
      benchmarkVersion: estimate.benchmarkVersion,
    },
    lead: {
      companyName: "테스트 주식회사",
      contactName: "테스트 담당자",
      email: "test@example.com",
      phone: "01000000000",
    },
    privacy: {
      basis: "CONSENT",
      noticeVersion: PRIVACY_NOTICE_VERSION,
      agreed: true,
    },
    marketing: {
      agreed: false,
      channels: [],
      consentVersion: MARKETING_CONSENT_VERSION,
    },
    sourcePath: "/",
  });
}

describe("handleQuickEstimatePost", () => {
  it("검증된 제출을 저장하고 신규 성공 응답을 반환한다", () => {
    const storeSubmission = vi.fn(() => ({
      ok: true as const,
      leadId: "4d95c6c8-0217-44c7-9d84-e81842721767",
      duplicate: false,
    }));
    const logFailure = vi.fn();

    const result = handleQuickEstimatePost(createPayload(), {
      storeSubmission,
      logFailure,
      now: () => new Date(OCCURRED_AT),
    });

    expect(result).toEqual({
      ok: true,
      leadId: "4d95c6c8-0217-44c7-9d84-e81842721767",
      duplicate: false,
    });
    expect(storeSubmission).toHaveBeenCalledOnce();
    expect(logFailure).not.toHaveBeenCalled();
  });

  it("검증 실패 시 Sheet 저장 없이 안정적인 오류 코드만 기록한다", () => {
    const storeSubmission = vi.fn();
    const logFailure = vi.fn();

    const result = handleQuickEstimatePost("{", {
      storeSubmission,
      logFailure,
      now: () => new Date(OCCURRED_AT),
    });

    expect(result).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(storeSubmission).not.toHaveBeenCalled();
    expect(logFailure).toHaveBeenCalledWith({
      code: "INVALID_INPUT",
      occurredAt: OCCURRED_AT,
    });
  });

  it("저장 실패 로그에는 request_id와 코드·시각만 포함한다", () => {
    const logFailure = vi.fn();

    const result = handleQuickEstimatePost(createPayload(), {
      storeSubmission: () => ({ ok: false, code: "STORAGE_UNAVAILABLE" }),
      logFailure,
      now: () => new Date(OCCURRED_AT),
    });

    expect(result).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
    expect(logFailure).toHaveBeenCalledWith({
      code: "STORAGE_UNAVAILABLE",
      occurredAt: OCCURRED_AT,
      requestId: "0fca3874-40bc-4ea9-a7ad-742a062736ea",
    });
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain("test@example.com");
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain("01000000000");
  });

  it("logger 장애가 검증 실패 응답을 바꾸지 않는다", () => {
    const result = handleQuickEstimatePost("{", {
      storeSubmission: vi.fn(),
      logFailure: () => {
        throw new Error("logger_unavailable");
      },
      now: () => new Date(OCCURRED_AT),
    });

    expect(result).toEqual({ ok: false, code: "INVALID_INPUT" });
  });
});
