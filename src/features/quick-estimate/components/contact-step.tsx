"use client";

import type { FormEvent } from "react";

import { QuickEstimateField } from "./quick-estimate-field";
import styles from "./quick-estimate-dialog.module.css";
import type { QuickEstimateContactValues } from "../types/quick-estimate-ui";

type ContactField = keyof QuickEstimateContactValues;

type QuickEstimateContactStepProps = {
  values: QuickEstimateContactValues;
  showErrors?: boolean;
  onChange: (field: ContactField, value: string) => void;
  onNext: () => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PHONE_SEPARATOR_PATTERN = /[\s().-]/gu;

function getContactError(field: ContactField, value: string): string | undefined {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return "필수 입력 항목입니다.";
  }

  if (field === "companyName" && normalized.length > 100) {
    return "회사명은 100자 이하로 입력해 주세요.";
  }

  if (field === "contactName" && normalized.length > 50) {
    return "담당자 이름은 50자 이하로 입력해 주세요.";
  }

  if (field === "email" && (normalized.length > 254 || !EMAIL_PATTERN.test(normalized))) {
    return "이메일 형식을 확인해 주세요.";
  }

  if (field === "phone") {
    const digits = normalized.replace(PHONE_SEPARATOR_PATTERN, "");

    if (!/^\d{9,11}$/u.test(digits)) {
      return "전화번호는 숫자 9~11자리로 입력해 주세요.";
    }
  }

  return undefined;
}

/**
 * 회사명·담당자 이름·이메일·전화번호를 받고 유효할 때만 다음 단계를 허용합니다.
 */
export function QuickEstimateContactStep({
  values,
  showErrors = false,
  onChange,
  onNext,
}: QuickEstimateContactStepProps) {
  const errors = {
    companyName: getContactError("companyName", values.companyName),
    contactName: getContactError("contactName", values.contactName),
    email: getContactError("email", values.email),
    phone: getContactError("phone", values.phone),
  };
  const isComplete = Object.values(errors).every((error) => error === undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isComplete) {
      onNext();
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <QuickEstimateField
        id="quick-estimate-company-name"
        label="회사명"
        placeholder="회사명을 입력해 주세요."
        autoComplete="organization"
        maxLength={100}
        value={values.companyName}
        error={showErrors ? errors.companyName : undefined}
        initialFocus
        onChange={(event) => onChange("companyName", event.currentTarget.value)}
      />
      <QuickEstimateField
        id="quick-estimate-contact-name"
        label="담당자 이름"
        placeholder="담당자 이름을 입력해 주세요."
        autoComplete="name"
        maxLength={50}
        value={values.contactName}
        error={showErrors ? errors.contactName : undefined}
        onChange={(event) => onChange("contactName", event.currentTarget.value)}
      />
      <QuickEstimateField
        id="quick-estimate-email"
        label="이메일"
        type="email"
        placeholder="example@company.com"
        autoComplete="email"
        maxLength={254}
        value={values.email}
        error={showErrors ? errors.email : undefined}
        onChange={(event) => onChange("email", event.currentTarget.value)}
      />
      <QuickEstimateField
        id="quick-estimate-phone"
        label="전화번호"
        type="tel"
        inputMode="tel"
        placeholder="- 없이 입력해 주세요."
        autoComplete="tel"
        maxLength={30}
        value={values.phone}
        error={showErrors ? errors.phone : undefined}
        onChange={(event) => onChange("phone", event.currentTarget.value)}
      />
      <button type="submit" disabled={!isComplete} className={styles.primaryButton}>
        다음
      </button>
    </form>
  );
}
