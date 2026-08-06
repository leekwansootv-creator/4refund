import { describe, expect, it } from "vitest";

import { calculateEstimate } from "../lib/calculate-estimate";
import type { QuickEstimateLeadDraft } from "../types/lead-submission";
import { createQuickEstimateSubmissionPayload } from "./lead-submission";

const REQUEST_ID = "0fca3874-40bc-4ea9-a7ad-742a062736ea";

function createDraft(): QuickEstimateLeadDraft {
  const estimate = calculateEstimate({
    industryCode: "software_it",
    employeeCount: 10,
    randomUpliftBps: 200,
  });

  if (estimate.status !== "calculated") {
    throw new Error("유효한 테스트 견적을 생성하지 못했습니다.");
  }

  return {
    estimate,
    lead: {
      companyName: " 테스트 주식회사 ",
      contactName: " 테스트 담당자 ",
      email: "Test.Person@example.com ",
      phone: "010-0000-0000",
    },
    privacyAgreed: true,
    marketing: {
      agreed: false,
      channels: [],
    },
  };
}

describe("createQuickEstimateSubmissionPayload", () => {
  it("유효한 초안을 서버 계약에 맞춰 정규화한다", () => {
    expect(createQuickEstimateSubmissionPayload(createDraft(), REQUEST_ID)).toEqual({
      ok: true,
      payload: expect.objectContaining({
        requestId: REQUEST_ID,
        lead: {
          companyName: "테스트 주식회사",
          contactName: "테스트 담당자",
          email: "Test.Person@example.com",
          phone: "01000000000",
        },
        privacy: {
          basis: "CONSENT",
          noticeVersion: "privacy-2026-08-06-v1",
          agreed: true,
        },
        marketing: {
          agreed: false,
          channels: [],
          consentVersion: "marketing-2026-08-06-v1",
        },
        sourcePath: "/",
      }),
    });
  });

  it.each([
    ["invalid_company_name", { companyName: " " }],
    ["invalid_contact_name", { contactName: "이름\u0000" }],
    ["invalid_email", { email: "invalid" }],
    ["invalid_phone", { phone: "1234" }],
  ] as const)("연락처 오류 %s를 반환한다", (issue, leadOverride) => {
    const draft = createDraft();
    draft.lead = { ...draft.lead, ...leadOverride };

    expect(createQuickEstimateSubmissionPayload(draft, REQUEST_ID)).toEqual({
      ok: false,
      issues: [issue],
    });
  });

  it("필수 개인정보 동의 누락을 거절한다", () => {
    const draft = createDraft();
    draft.privacyAgreed = false;

    expect(createQuickEstimateSubmissionPayload(draft, REQUEST_ID)).toEqual({
      ok: false,
      issues: ["privacy_consent_required"],
    });
  });

  it("마케팅 미동의와 빈 채널을 정상 요청으로 허용한다", () => {
    expect(createQuickEstimateSubmissionPayload(createDraft(), REQUEST_ID)).toMatchObject({
      ok: true,
      payload: {
        marketing: {
          agreed: false,
          channels: [],
        },
      },
    });
  });

  it.each([
    { agreed: true, channels: [] },
    { agreed: false, channels: ["EMAIL"] },
    { agreed: true, channels: ["SMS", "SMS"] },
  ] as const)("동의 여부와 맞지 않는 마케팅 채널을 거절한다", (marketing) => {
    const draft = createDraft();
    draft.marketing = marketing;

    expect(createQuickEstimateSubmissionPayload(draft, REQUEST_ID)).toEqual({
      ok: false,
      issues: ["invalid_marketing_consent"],
    });
  });

  it("마케팅 동의 채널을 고정 순서로 정규화한다", () => {
    const draft = createDraft();
    draft.marketing = { agreed: true, channels: ["SMS", "EMAIL"] };

    expect(createQuickEstimateSubmissionPayload(draft, REQUEST_ID)).toMatchObject({
      ok: true,
      payload: {
        marketing: {
          agreed: true,
          channels: ["EMAIL", "SMS"],
        },
      },
    });
  });

  it("유효하지 않은 request_id와 변조된 견적을 거절한다", () => {
    const draft = createDraft();

    if (draft.estimate.status !== "calculated") {
      throw new Error("유효한 테스트 견적을 생성하지 못했습니다.");
    }

    draft.estimate = { ...draft.estimate, amount: draft.estimate.amount + 10_000 };

    expect(createQuickEstimateSubmissionPayload(draft, "invalid")).toEqual({
      ok: false,
      issues: ["invalid_request_id", "invalid_estimate"],
    });
  });

  it("수식 시작 문자는 클라이언트에서 제거하지 않고 서버 방어 경계로 전달한다", () => {
    const draft = createDraft();
    draft.lead.companyName = "=1+1 테스트";

    expect(createQuickEstimateSubmissionPayload(draft, REQUEST_ID)).toMatchObject({
      ok: true,
      payload: {
        lead: { companyName: "=1+1 테스트" },
      },
    });
  });
});
