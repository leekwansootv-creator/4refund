"use client";

import { useState, type FormEvent } from "react";
import { QuickEstimateConsents } from "./estimate-consents";

import { QuickEstimateField } from "./quick-estimate-field";
import styles from "./quick-estimate-dialog.module.css";
import type {
  QuickEstimateContactValues,
  QuickEstimateConsentValues,
} from "../types/quick-estimate-ui";

type ContactField = keyof QuickEstimateContactValues;

type QuickEstimateContactStepProps = {
  values: QuickEstimateContactValues;
  consentValues: QuickEstimateConsentValues;
  onConsentChange: (field: keyof QuickEstimateConsentValues, value: boolean) => void;
  onBack: () => void;
  honeypotValue?: string;
  showErrors?: boolean;
  onChange: (field: ContactField, value: string) => void;
  onHoneypotChange?: (value: string) => void;
  onSubmit: () => void;
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
 * 네 연락처 필드와 필수 동의를 검증하고 명시적인 최종 신청만 전달합니다.
 */
export function QuickEstimateContactStep({
  values,
  consentValues,
  onConsentChange,
  onBack,
  honeypotValue = "",
  showErrors = false,
  onChange,
  onHoneypotChange,
  onSubmit,
}: QuickEstimateContactStepProps) {
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const errors = {
    companyName: getContactError("companyName", values.companyName),
    contactName: getContactError("contactName", values.contactName),
    email: getContactError("email", values.email),
    phone: getContactError("phone", values.phone),
  };
  const isComplete =
    consentValues.privacyAgreed && Object.values(errors).every((error) => error === undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isComplete) {
      onSubmit();
    }
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div className={styles.botTrap} aria-hidden="true">
        <label htmlFor="quick-estimate-company-website">회사 웹사이트</label>
        <input
          id="quick-estimate-company-website"
          name="company-website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
          value={honeypotValue}
          onChange={(event) => onHoneypotChange?.(event.currentTarget.value)}
        />
      </div>
      <QuickEstimateField
        id="quick-estimate-company-name"
        label="회사명"
        placeholder="회사명을 입력해 주세요."
        autoComplete="organization"
        maxLength={100}
        value={values.companyName}
        error={showErrors || touched.companyName ? errors.companyName : undefined}
        required
        reserveErrorSpace
        onBlur={() => setTouched((current) => ({ ...current, companyName: true }))}
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
        error={showErrors || touched.contactName ? errors.contactName : undefined}
        required
        reserveErrorSpace
        onBlur={() => setTouched((current) => ({ ...current, contactName: true }))}
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
        error={showErrors || touched.email ? errors.email : undefined}
        required
        reserveErrorSpace
        onBlur={() => setTouched((current) => ({ ...current, email: true }))}
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
        error={showErrors || touched.phone ? errors.phone : undefined}
        required
        reserveErrorSpace
        onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
        onChange={(event) => onChange("phone", event.currentTarget.value)}
      />
      <QuickEstimateConsents
        values={consentValues}
        onChange={onConsentChange}
        showErrors={showErrors}
      />
      <button type="submit" disabled={!isComplete} className={styles.primaryButton}>
        상세 견적 신청하기
      </button>
      <button type="button" className={styles.secondaryButton} onClick={onBack}>
        결과로 돌아가기
      </button>
    </form>
  );
}
