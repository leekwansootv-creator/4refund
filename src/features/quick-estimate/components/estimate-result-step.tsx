"use client";

import { useEffect, useRef } from "react";

import styles from "./quick-estimate-dialog.module.css";
import type { QuickEstimateResultFeedback } from "../types/quick-estimate-ui";

type QuickEstimateResultStepProps = {
  amount: number;
  employeeCount: number;
  industryLabel: string;
  feedback: QuickEstimateResultFeedback;
  onConsult: () => void;
  onRestart: () => void;
};

function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function SubmissionFeedback({ feedback }: { feedback: QuickEstimateResultFeedback }) {
  const failureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedback.status === "failed") {
      failureRef.current?.focus();
    }
  }, [feedback.status]);

  switch (feedback.status) {
    case "idle":
      return <div aria-live="polite" className={styles.feedback} />;
    case "submitting":
      return (
        <p aria-live="polite" className={styles.feedback}>
          상담 신청을 접수하고 있습니다.
        </p>
      );
    case "succeeded":
      return (
        <p aria-live="polite" className={styles.feedback}>
          상담 신청이 접수되었습니다.
        </p>
      );
    case "failed":
      return (
        <div
          ref={failureRef}
          aria-live="polite"
          className={`${styles.feedback} ${styles.feedbackError}`}
          tabIndex={-1}
        >
          <p>{feedback.message}</p>
          <p>입력 내용과 예상 환급액은 유지됩니다.</p>
          <div className="mt-2 flex gap-4">
            <button type="button" className="underline" onClick={feedback.onEditContact}>
              연락처 수정
            </button>
            <button type="button" className="underline" onClick={feedback.onRetry}>
              접수 다시 시도
            </button>
          </div>
        </div>
      );
  }
}

/**
 * 계산된 참고용 예상 금액과 독립적인 상담 접수 상태·후속 action을 표시합니다.
 */
export function QuickEstimateResultStep({
  amount,
  employeeCount,
  industryLabel,
  feedback,
  onConsult,
  onRestart,
}: QuickEstimateResultStepProps) {
  const submitting = feedback.status === "submitting";

  return (
    <div
      role="region"
      aria-label="간단 견적 조회 결과"
      className="flex flex-col gap-6"
      data-dialog-initial-focus
      tabIndex={-1}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="font-bold text-[#666]">업종</dt>
        <dd className="min-w-0 text-[#212121]">{industryLabel}</dd>
        <dt className="font-bold text-[#666]">직원 수</dt>
        <dd className="text-[#212121]">{employeeCount.toLocaleString("ko-KR")}명</dd>
      </dl>

      <div className={styles.resultCard}>
        <p className="text-sm text-[#737373]">예상 환급액</p>
        <p className="text-[28px] text-[#2166ed]">{formatWon(amount)}</p>
      </div>

      <p className="text-[11px] leading-normal font-bold text-[#999]">
        ※ 본 결과는 참고용 예상값이며, 실제 환급액과 다를 수 있습니다.
        <br />
        정확한 금액은 전문가와 상담하세요.
      </p>

      <SubmissionFeedback feedback={feedback} />

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={submitting}
          className={styles.primaryButton}
          onClick={onRestart}
        >
          다시 조회하기
        </button>
        <button
          type="button"
          disabled={submitting}
          className={styles.primaryButton}
          onClick={onConsult}
        >
          상담하기
        </button>
      </div>
    </div>
  );
}
