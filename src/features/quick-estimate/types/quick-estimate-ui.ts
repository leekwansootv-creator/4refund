import type { EstimateIndustryCode } from "../constants/estimate-rule-set";

/** 담당자 입력 단계가 편집하는 승인된 네 개의 연락처 필드입니다. */
export type QuickEstimateContactValues = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
};

/** 견적 입력 단계가 편집하는 업종과 직원 수입니다. */
export type QuickEstimateFormValues = {
  industryCode: EstimateIndustryCode | "";
  employeeCount: string;
};

/** 상담 접수의 필수 개인정보 동의와 선택 마케팅 동의를 별도로 보존합니다. */
export type QuickEstimateConsentValues = {
  privacyAgreed: boolean;
  marketingAgreed: boolean;
};

/** 결과 금액과 독립적으로 표시하는 상담 접수 진행 상태입니다. */
export type QuickEstimateResultFeedback =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "succeeded" }
  | {
      status: "failed";
      message: string;
      onEditContact: () => void;
      onRetry: () => void;
    };
