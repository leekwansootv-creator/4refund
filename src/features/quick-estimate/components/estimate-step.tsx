"use client";

import type { FormEvent } from "react";

import { ConsentDisclosure } from "./consent-disclosure";
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

const PRIVACY_NOTICE = [
  "수집 항목: 회사명, 담당자 이름, 이메일, 전화번호, 업종, 직원 수, 예상 환급액",
  "이용 목적: 간단 견적 상담 신청 접수, 담당자 연락 및 상담 상태 관리",
  "보유 기간: 접수일부터 1년",
  "",
  "동의를 거부할 수 있으나, 거부 시 예상 견적 상담 접수가 제한됩니다.",
].join("\n");

const MARKETING_NOTICE = [
  "이용 목적: 4대보험 환급 관련 혜택, 상담 및 서비스 소식 안내",
  "이용 채널: 이메일, 문자(SMS)",
  "보유 기간: 동의일부터 1년 또는 철회 시까지",
  "",
  "동의하지 않아도 예상 견적 확인과 상담 접수를 이용할 수 있습니다.",
].join("\n");

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
 * 업종·직원 수와 필수 개인정보·선택 마케팅 동의를 분리해 입력받습니다.
 */
export function QuickEstimateEstimateStep({
  values,
  showErrors = false,
  onChange,
  onLookup,
}: QuickEstimateEstimateStepProps) {
  const employeeCountValid = isEmployeeCountValid(values.employeeCount);
  const isComplete = values.industryCode !== "" && employeeCountValid && values.privacyAgreed;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isComplete) {
      onLookup();
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
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
          <p className={styles.error}>업종을 선택해 주세요.</p>
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
          showErrors && !employeeCountValid
            ? `직원 수는 ${ESTIMATE_RULE_SET.employeeCount.min.toLocaleString("ko-KR")}~${ESTIMATE_RULE_SET.employeeCount.max.toLocaleString("ko-KR")}명으로 입력해 주세요.`
            : undefined
        }
        onChange={(event) => onChange("employeeCount", event.currentTarget.value)}
      />

      <div className="flex flex-col gap-3">
        <ConsentDisclosure
          checked={values.privacyAgreed}
          required
          label="개인정보 처리 동의"
          onCheckedChange={(checked) => onChange("privacyAgreed", checked)}
        >
          {PRIVACY_NOTICE}
        </ConsentDisclosure>
        <ConsentDisclosure
          checked={values.marketingAgreed}
          required={false}
          label="마케팅 활용 동의"
          onCheckedChange={(checked) => onChange("marketingAgreed", checked)}
        >
          {MARKETING_NOTICE}
        </ConsentDisclosure>
        {showErrors && !values.privacyAgreed ? (
          <p className={styles.error}>개인정보 처리 동의가 필요합니다.</p>
        ) : null}
      </div>

      <button type="submit" disabled={!isComplete} className={styles.primaryButton}>
        조회하기
      </button>
    </form>
  );
}
