import type { EstimateIndustryCode } from "../constants/estimate-rule-set";

/** 담당자 입력 단계가 편집하는 승인된 네 개의 연락처 필드입니다. */
export type QuickEstimateContactValues = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
};

/** 견적 입력 단계가 편집하는 계산 조건과 분리된 동의 값입니다. */
export type QuickEstimateFormValues = {
  industryCode: EstimateIndustryCode | "";
  employeeCount: string;
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
