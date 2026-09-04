"use client";

import { ConsentDisclosure } from "./consent-disclosure";
import styles from "./quick-estimate-dialog.module.css";
import type { QuickEstimateConsentValues } from "../types/quick-estimate-ui";

type QuickEstimateConsentsProps = {
  values: QuickEstimateConsentValues;
  showErrors?: boolean;
  onChange: (field: keyof QuickEstimateConsentValues, value: boolean) => void;
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

/** 기존 고지 전문과 선택권을 유지하면서 상담 동의 입력만 소유합니다. */
export function QuickEstimateConsents({
  values,
  showErrors = false,
  onChange,
}: QuickEstimateConsentsProps) {
  return (
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
  );
}
