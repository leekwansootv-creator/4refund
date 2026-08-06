import { ESTIMATE_RULE_SET } from "../constants/estimate-rule-set";
import type { EstimateCalculationInput, EstimateResult } from "../types/estimate";

function roundToNearestUnit(amount: number, unit: number): number {
  return Math.round(amount / unit) * unit;
}

function roundUpToUnit(amount: number, unit: number): number {
  return Math.ceil(amount / unit) * unit;
}

/**
 * 승인된 규칙으로 참고용 예상 환급액을 계산합니다.
 *
 * 난수 생성과 화면 상태를 이 함수 밖에 두어 동일 입력을 항상 재현합니다.
 * 표시금액 상한을 넘는 결과는 금액을 잘라 반환하지 않고 실패로 처리합니다.
 */
export function calculateEstimate(input: EstimateCalculationInput): EstimateResult {
  const industry = ESTIMATE_RULE_SET.industries.find(({ code }) => code === input.industryCode);

  if (industry === undefined) {
    return { status: "unsupported", reason: "unsupported_industry" };
  }

  if (!Number.isInteger(input.employeeCount)) {
    return { status: "invalid", reason: "employee_count_not_integer" };
  }

  if (
    input.employeeCount < ESTIMATE_RULE_SET.employeeCount.min ||
    input.employeeCount > ESTIMATE_RULE_SET.employeeCount.max
  ) {
    return { status: "invalid", reason: "employee_count_out_of_range" };
  }

  if (!Number.isInteger(input.randomUpliftBps)) {
    return { status: "invalid", reason: "random_uplift_not_integer" };
  }

  if (
    input.randomUpliftBps < ESTIMATE_RULE_SET.randomUpliftBps.min ||
    input.randomUpliftBps > ESTIMATE_RULE_SET.randomUpliftBps.max
  ) {
    return { status: "invalid", reason: "random_uplift_out_of_range" };
  }

  const benchmarkAmount = roundToNearestUnit(
    industry.benchmarkRatePerEmployee * input.employeeCount,
    ESTIMATE_RULE_SET.displayUnit,
  );

  // 정수 basis point 연산을 유지해 부동소수점 비율 변환에 따른 경계 오차를 피합니다.
  const upliftedAmount =
    (industry.baseRatePerEmployee * input.employeeCount * (10_000 + input.randomUpliftBps)) /
    10_000;
  const candidateAmount = roundUpToUnit(upliftedAmount, ESTIMATE_RULE_SET.displayUnit);
  const amount = Math.max(candidateAmount, benchmarkAmount + ESTIMATE_RULE_SET.displayUnit);

  if (amount > ESTIMATE_RULE_SET.maxDisplayAmount) {
    return { status: "invalid", reason: "amount_limit_exceeded" };
  }

  return {
    status: "calculated",
    industryCode: industry.code,
    employeeCount: input.employeeCount,
    amount,
    currency: ESTIMATE_RULE_SET.currency,
    randomUpliftBps: input.randomUpliftBps,
    ruleVersion: ESTIMATE_RULE_SET.version,
    benchmarkVersion: ESTIMATE_RULE_SET.benchmarkVersion,
  };
}
