"use client";

import { QuickEstimateSummary } from "./estimate-summary";
import styles from "./quick-estimate-dialog.module.css";
import type { QuickEstimateSummaryValues } from "../types/quick-estimate-ui";
import type { QuickEstimateSubmissionState } from "../lib/submission-state";
import type { SubmissionRecovery } from "../lib/submission-recovery";

type SubmissionStepProps = {
  summary: QuickEstimateSummaryValues;
  state: QuickEstimateSubmissionState;
  recovery: SubmissionRecovery | null;
  onRecover: () => void;
  onClose: () => void;
};

/** 저장 확인 전 진행·실패와 실제 성공 응답 뒤 완료를 별도 화면으로 표시합니다. */
export function QuickEstimateSubmissionStep({
  summary,
  state,
  recovery,
  onRecover,
  onClose,
}: SubmissionStepProps) {
  return (
    <div
      role="region"
      aria-label="상세 견적 접수 상태"
      className="flex flex-col gap-6"
      data-dialog-initial-focus
      tabIndex={-1}
    >
      <div role="status" className={styles.description}>
        {state.status === "submitting" ? <p>상세 견적 신청을 접수하고 있습니다.</p> : null}
        {state.status === "succeeded" ? (
          <>
            <p>상세 견적 신청이 접수되었습니다.</p>
            <p>남겨주신 연락처로 상담을 안내해 드립니다.</p>
          </>
        ) : null}
        {recovery ? (
          <>
            <p className={styles.feedbackError}>{recovery.message}</p>
            <p>입력 내용과 예상 환급액은 유지됩니다.</p>
          </>
        ) : null}
      </div>
      <QuickEstimateSummary {...summary} />
      {recovery ? (
        <button type="button" className={styles.primaryButton} onClick={onRecover}>
          {recovery.label}
        </button>
      ) : null}
      {state.status === "succeeded" ? (
        <button type="button" className={styles.primaryButton} onClick={onClose}>
          확인
        </button>
      ) : null}
    </div>
  );
}
