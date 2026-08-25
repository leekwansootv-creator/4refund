import type { EstimateIndustryCode } from "../constants/estimate-rule-set";

/** 순수 계산 core가 받는 업종, 사원 수, 난수 입력입니다. */
export type EstimateCalculationInput = {
  industryCode: string;
  employeeCount: number;
  randomUpliftBps: number;
  ruleVersion?: string;
};

/** 입력 형식이나 승인 범위를 벗어난 계산 실패 코드입니다. */
export type EstimateInvalidReason =
  | "employee_count_not_integer"
  | "employee_count_out_of_range"
  | "random_uplift_not_integer"
  | "random_uplift_out_of_range"
  | "amount_limit_exceeded";

/** UI 문구와 분리된 간단 견적 계산 결과 계약입니다. */
export type EstimateResult =
  | {
      status: "calculated";
      industryCode: EstimateIndustryCode;
      employeeCount: number;
      amount: number;
      currency: "KRW";
      randomUpliftBps: number;
      ruleVersion: string;
      benchmarkVersion: string;
    }
  | {
      status: "invalid";
      reason: EstimateInvalidReason;
    }
  | {
      status: "unsupported";
      reason: "unsupported_industry" | "unsupported_rule_version";
    };
