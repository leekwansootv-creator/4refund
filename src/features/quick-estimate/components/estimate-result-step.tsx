"use client";

import { QuickEstimateSummary } from "./estimate-summary";
import styles from "./quick-estimate-dialog.module.css";
import type { QuickEstimateSummaryValues } from "../types/quick-estimate-ui";

type QuickEstimateResultStepProps = QuickEstimateSummaryValues & {
  onApply: (() => void) | null;
  onConsult: () => void;
  onRestart: () => void;
};

/** 접수 전 참고용 예상액을 표시하고 신청 입력 또는 재조회로 연결합니다. */
export function QuickEstimateResultStep({
  onApply,
  onConsult,
  onRestart,
  ...summary
}: QuickEstimateResultStepProps) {
  return (
    <div
      role="region"
      aria-label="간단 견적 조회 결과"
      className="flex flex-col gap-6"
      data-dialog-initial-focus
      tabIndex={-1}
    >
      <QuickEstimateSummary {...summary} />
      {onApply ? (
        <>
          <p className={styles.description}>
            더 자세한 견적을 원하시나요? 회사와 담당자 정보를 남겨주시면 상담을 통해 안내해
            드립니다.
          </p>
          <button type="button" className={styles.primaryButton} onClick={onApply}>
            상세 견적 받기
          </button>
        </>
      ) : (
        <>
          <p className={styles.description}>
            상세 견적 접수 환경을 준비하고 있습니다. 아래 문의 경로를 이용해 주세요.
          </p>
          <button type="button" className={styles.primaryButton} onClick={onConsult}>
            문의하기
          </button>
        </>
      )}
      <button type="button" className={styles.secondaryButton} onClick={onRestart}>
        다시 조회하기
      </button>
    </div>
  );
}
