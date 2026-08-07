import {
  ESTIMATE_BENCHMARK_VERSION,
  ESTIMATE_RULE_VERSION,
  MARKETING_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  SUBMISSION_PAYLOAD_MAX_BYTES,
  calculateEstimate,
} from "@/features/quick-estimate";
import { describe, expect, it } from "vitest";

import { parseAndValidateSubmissionPayload } from "./validate-submission";

function createValidPayload(): Record<string, unknown> {
  const estimate = calculateEstimate({
    industryCode: "software_it",
    employeeCount: 10,
    randomUpliftBps: 200,
  });

  if (estimate.status !== "calculated") {
    throw new Error("유효한 테스트 견적을 생성하지 못했습니다.");
  }

  return {
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
      companyName: " 테스트 주식회사 ",
      contactName: " 테스트 담당자 ",
      email: "Test.Person@example.com ",
      phone: "010-0000-0000",
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
    antiSpam: {
      honeypot: "",
      elapsedMs: 5_000,
    },
    sourcePath: "/",
  };
}

function validate(payload: Record<string, unknown>) {
  return parseAndValidateSubmissionPayload(JSON.stringify(payload));
}

describe("parseAndValidateSubmissionPayload", () => {
  it("허용된 payload를 정규화하고 계산 결과를 재현한다", () => {
    const result = validate(createValidPayload());

    expect(result).toMatchObject({
      ok: true,
      submission: {
        requestId: "0fca3874-40bc-4ea9-a7ad-742a062736ea",
        lead: {
          companyName: "테스트 주식회사",
          contactName: "테스트 담당자",
          email: "Test.Person@example.com",
          phone: "01000000000",
        },
      },
    });
  });

  it("허용되지 않은 최상위 또는 하위 필드를 거절한다", () => {
    const rootPayload = { ...createValidPayload(), submittedAt: "2026-08-06T00:00:00.000Z" };
    const nestedPayload = createValidPayload();

    nestedPayload.lead = {
      ...(nestedPayload.lead as Record<string, unknown>),
      memo: "저장하면 안 되는 자유 입력",
    };

    expect(validate(rootPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(validate(nestedPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
  });

  it.each([
    { honeypot: "https://spam.example", elapsedMs: 5_000 },
    { honeypot: "", elapsedMs: 2_999 },
    { honeypot: "", elapsedMs: 7_200_001 },
    { honeypot: "", elapsedMs: 5_000.5 },
  ])("자동 제출 징후 %o를 거절한다", (antiSpam) => {
    const payload = createValidPayload();
    payload.antiSpam = antiSpam;

    expect(validate(payload)).toEqual({ ok: false, code: "INVALID_INPUT" });
  });

  it("변조된 금액과 계산 입력을 거절한다", () => {
    const amountPayload = createValidPayload();
    const countPayload = createValidPayload();
    const upliftPayload = createValidPayload();

    amountPayload.estimate = {
      ...(amountPayload.estimate as Record<string, unknown>),
      amount: 1,
    };
    countPayload.estimate = {
      ...(countPayload.estimate as Record<string, unknown>),
      employeeCount: 6_001,
    };
    upliftPayload.estimate = {
      ...(upliftPayload.estimate as Record<string, unknown>),
      randomUpliftBps: 301,
    };

    expect(validate(amountPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(validate(countPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(validate(upliftPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
  });

  it("지원하지 않는 업종과 규칙 version을 구분해 거절한다", () => {
    const industryPayload = createValidPayload();
    const rulePayload = createValidPayload();
    const benchmarkPayload = createValidPayload();

    industryPayload.estimate = {
      ...(industryPayload.estimate as Record<string, unknown>),
      industryCode: "unknown",
    };
    rulePayload.estimate = {
      ...(rulePayload.estimate as Record<string, unknown>),
      ruleVersion: `${ESTIMATE_RULE_VERSION}-old`,
    };
    benchmarkPayload.estimate = {
      ...(benchmarkPayload.estimate as Record<string, unknown>),
      benchmarkVersion: `${ESTIMATE_BENCHMARK_VERSION}-old`,
    };

    expect(validate(industryPayload)).toEqual({ ok: false, code: "UNSUPPORTED_RULE" });
    expect(validate(rulePayload)).toEqual({ ok: false, code: "UNSUPPORTED_RULE" });
    expect(validate(benchmarkPayload)).toEqual({ ok: false, code: "UNSUPPORTED_RULE" });
  });

  it("필수 개인정보 동의와 선택 마케팅 조합을 검증한다", () => {
    const privacyPayload = createValidPayload();
    const optedOutPayload = createValidPayload();
    const optedInPayload = createValidPayload();

    privacyPayload.privacy = {
      ...(privacyPayload.privacy as Record<string, unknown>),
      agreed: false,
    };
    optedOutPayload.marketing = {
      ...(optedOutPayload.marketing as Record<string, unknown>),
      channels: ["EMAIL"],
    };
    optedInPayload.marketing = {
      agreed: true,
      channels: ["SMS", "EMAIL"],
      consentVersion: MARKETING_CONSENT_VERSION,
    };

    expect(validate(privacyPayload)).toEqual({ ok: false, code: "INVALID_CONSENT" });
    expect(validate(optedOutPayload)).toEqual({ ok: false, code: "INVALID_CONSENT" });
    expect(validate(optedInPayload)).toMatchObject({
      ok: true,
      submission: {
        marketing: {
          agreed: true,
          channels: ["EMAIL", "SMS"],
        },
      },
    });
  });

  it("제어문자, 잘못된 연락처와 허용되지 않은 source path를 거절한다", () => {
    const companyPayload = createValidPayload();
    const emailPayload = createValidPayload();
    const phonePayload = createValidPayload();
    const sourcePayload = createValidPayload();

    companyPayload.lead = {
      ...(companyPayload.lead as Record<string, unknown>),
      companyName: "테스트\n주식회사",
    };
    emailPayload.lead = {
      ...(emailPayload.lead as Record<string, unknown>),
      email: "invalid.example.com",
    };
    phonePayload.lead = {
      ...(phonePayload.lead as Record<string, unknown>),
      phone: "+82-10-0000-0000",
    };
    sourcePayload.sourcePath = "/admin";

    expect(validate(companyPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(validate(emailPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(validate(phonePayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(validate(sourcePayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
  });

  it("UUID v4, JSON 형식과 UTF-8 크기 제한을 검증한다", () => {
    const uuidPayload = createValidPayload();
    uuidPayload.requestId = "not-a-uuid";

    expect(validate(uuidPayload)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(parseAndValidateSubmissionPayload("{")).toEqual({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(parseAndValidateSubmissionPayload("가".repeat(SUBMISSION_PAYLOAD_MAX_BYTES))).toEqual({
      ok: false,
      code: "INVALID_INPUT",
    });
  });
});
