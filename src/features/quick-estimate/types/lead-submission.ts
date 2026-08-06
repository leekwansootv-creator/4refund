import type { EstimateIndustryCode } from "../constants/estimate-rule-set";
import {
  MARKETING_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
} from "../constants/lead-submission-contract";
import type { EstimateResult } from "./estimate";

/** 선택 마케팅 활용에 동의할 수 있는 연락 채널입니다. */
export type MarketingChannel = "EMAIL" | "SMS";

/** 연락처와 동의 입력을 견적 결과와 결합한 브라우저 제출 초안입니다. */
export type QuickEstimateLeadDraft = {
  estimate: EstimateResult;
  lead: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
  };
  privacyAgreed: boolean;
  marketing: {
    agreed: boolean;
    channels: readonly MarketingChannel[];
  };
};

/** 브라우저와 Apps Script가 공유하는 간단 견적 상담 wire payload입니다. */
export type QuickEstimateSubmissionPayload = {
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

/** Apps Script가 입력·동의·계산 규칙 검증 실패에 사용하는 공개 코드입니다. */
export type QuickEstimateSubmissionValidationErrorCode =
  "INVALID_INPUT" | "INVALID_CONSENT" | "UNSUPPORTED_RULE";

/** Apps Script가 저장 또는 내부 처리 실패에 사용하는 공개 코드입니다. */
export type QuickEstimateSubmissionServerErrorCode = "STORAGE_UNAVAILABLE" | "INTERNAL_ERROR";

/** 브라우저가 판독할 수 있는 Apps Script 상담 제출 응답입니다. */
export type QuickEstimateSubmissionResponse =
  | {
      ok: true;
      leadId: string;
      duplicate: boolean;
    }
  | {
      ok: false;
      code: QuickEstimateSubmissionValidationErrorCode | QuickEstimateSubmissionServerErrorCode;
    };

/** UI가 입력 항목별 안내를 선택할 수 있는 브라우저 제출 검증 코드입니다. */
export type QuickEstimateLeadValidationIssue =
  | "invalid_request_id"
  | "invalid_estimate"
  | "invalid_company_name"
  | "invalid_contact_name"
  | "invalid_email"
  | "invalid_phone"
  | "privacy_consent_required"
  | "invalid_marketing_consent"
  | "payload_too_large";

/** 제출 초안 정규화와 wire payload 생성 결과입니다. */
export type QuickEstimateLeadValidationResult =
  | {
      ok: true;
      payload: QuickEstimateSubmissionPayload;
    }
  | {
      ok: false;
      issues: QuickEstimateLeadValidationIssue[];
    };
