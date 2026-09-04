"use client";

import type { FormEvent } from "react";

import styles from "./quick-estimate-dialog.module.css";
import { QuickEstimateField } from "./quick-estimate-field";
import { ESTIMATE_RULE_SET, type EstimateIndustryCode } from "../constants/estimate-rule-set";
import type { QuickEstimateFormValues } from "../types/quick-estimate-ui";

type QuickEstimateEstimateStepProps = {
  values: QuickEstimateFormValues;
  showErrors?: boolean;
  onChange: <Field extends keyof QuickEstimateFormValues>(
    field: Field,
    value: QuickEstimateFormValues[Field],
  ) => void;
  onLookup: () => void;
};

function isEmployeeCountValid(value: string): boolean {
  if (!/^\d+$/u.test(value)) {
    return false;
  }

  const employeeCount = Number(value);

  return (
    Number.isInteger(employeeCount) &&
    employeeCount >= ESTIMATE_RULE_SET.employeeCount.min &&
    employeeCount <= ESTIMATE_RULE_SET.employeeCount.max
  );
}

/**
 * 연락처나 동의 없이 업종·직원 수만 검증해 브라우저 조회를 요청합니다.
 */
export function QuickEstimateEstimateStep({
  values,
  showErrors = false,
  onChange,
  onLookup,
}: QuickEstimateEstimateStepProps) {
  const employeeCountValid = isEmployeeCountValid(values.employeeCount);
  const isComplete = values.industryCode !== "" && employeeCountValid;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isComplete) {
      onLookup();
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <p className={styles.description}>업종과 직원 수만으로 예상 환급액을 확인해 보세요.</p>
      <div className={styles.field}>
        <label
          htmlFor="quick-estimate-industry"
          className="text-[15px] leading-normal font-bold text-[#333]"
        >
          업종
        </label>
        <div
          className={`${styles.control} ${styles.selectControl} ${
            showErrors && values.industryCode === "" ? styles.controlInvalid : ""
          }`}
        >
          <select
            id="quick-estimate-industry"
            required
            value={values.industryCode}
            aria-describedby={
              showErrors && values.industryCode === "" ? "quick-estimate-industry-error" : undefined
            }
            aria-invalid={showErrors && values.industryCode === "" ? true : undefined}
            className={styles.select}
            data-dialog-initial-focus
            onChange={(event) =>
              onChange("industryCode", event.currentTarget.value as EstimateIndustryCode | "")
            }
          >
            <option value="">업종 선택</option>
            {ESTIMATE_RULE_SET.industries.map((industry) => (
              <option key={industry.code} value={industry.code}>
                {industry.label}
              </option>
            ))}
          </select>
          <span aria-hidden="true" className={styles.selectArrow}>
            ▼
          </span>
        </div>
        {showErrors && values.industryCode === "" ? (
          <p id="quick-estimate-industry-error" className={styles.error}>
            업종을 선택해 주세요.
          </p>
        ) : null}
      </div>

      <QuickEstimateField
        id="quick-estimate-employee-count"
        label="직원 수"
        inputMode="numeric"
        placeholder="직원 수를 입력해 주세요."
        suffix="명"
        value={values.employeeCount}
        error={
          (showErrors || values.employeeCount !== "") && !employeeCountValid
            ? `직원 수는 ${ESTIMATE_RULE_SET.employeeCount.min.toLocaleString("ko-KR")}~${ESTIMATE_RULE_SET.employeeCount.max.toLocaleString("ko-KR")}명으로 입력해 주세요.`
            : undefined
        }
        onChange={(event) => onChange("employeeCount", event.currentTarget.value)}
      />

      <button type="submit" disabled={!isComplete} className={styles.primaryButton}>
        조회하기
      </button>
    </form>
  );
}
