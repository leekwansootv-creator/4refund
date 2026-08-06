import type { EstimateIndustryCode } from "@/features/quick-estimate";

/** 현재 Apps Script가 수락하는 개인정보 수집·이용 고지 버전입니다. */
export const PRIVACY_NOTICE_VERSION = "privacy-2026-08-06-v1";

/** 현재 Apps Script가 수락하는 선택 마케팅 동의 버전입니다. */
export const MARKETING_CONSENT_VERSION = "marketing-2026-08-06-v1";

/** form field 하나로 전달하는 JSON payload의 최대 UTF-8 크기입니다. */
export const SUBMISSION_PAYLOAD_MAX_BYTES = 16 * 1024;

/** 선택 마케팅에 사용할 수 있는 연락 채널입니다. */
export type MarketingChannel = "EMAIL" | "SMS";

/** 검증을 통과해 Sheet 저장에 사용할 수 있는 간단 견적 제출값입니다. */
export type QuickEstimateSubmission = {
  requestId: string;
  estimate: {
    industryCode: EstimateIndustryCode;
    employeeCount: number;
    amount: number;
    currency: "KRW";
    randomUpliftBps: number;
    ruleVersion: string;
    benchmarkVersion: string;
  };
  lead: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
  };
  privacy: {
    basis: "CONSENT";
    noticeVersion: typeof PRIVACY_NOTICE_VERSION;
    agreed: true;
  };
  marketing: {
    agreed: boolean;
    channels: MarketingChannel[];
    consentVersion: typeof MARKETING_CONSENT_VERSION;
  };
  sourcePath: "/";
};

/** 외부 응답에 노출할 수 있는 안정적인 제출 검증 실패 코드입니다. */
export type SubmissionValidationErrorCode =
  "INVALID_INPUT" | "INVALID_CONSENT" | "UNSUPPORTED_RULE";

/** 제출 payload 검증 결과와 정규화된 저장 입력 계약입니다. */
export type SubmissionValidationResult =
  | {
      ok: true;
      submission: QuickEstimateSubmission;
    }
  | {
      ok: false;
      code: SubmissionValidationErrorCode;
    };
