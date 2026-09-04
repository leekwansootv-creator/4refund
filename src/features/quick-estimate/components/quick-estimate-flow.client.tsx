"use client";

import { useRef, useState } from "react";
import { QuickEstimateContactStep } from "./contact-step";
import { QuickEstimateResultStep } from "./estimate-result-step";
import { QuickEstimateEstimateStep } from "./estimate-step";
import { QuickEstimateSummary } from "./estimate-summary";
import { QuickEstimateSubmissionStep } from "./submission-step";
import { QuickEstimateDialog } from "./quick-estimate-dialog";
import { QuickEstimateHeroAction } from "./quick-estimate-hero-action";
import styles from "./quick-estimate-dialog.module.css";
import { submitEstimateLead } from "../api/submit-estimate-lead";
import { ESTIMATE_RULE_SET } from "../constants/estimate-rule-set";
import { calculateEstimate } from "../lib/calculate-estimate";
import { generateRandomUpliftBps, type RandomUpliftSource } from "../lib/generate-random-uplift";
import type { SubmissionRequestIdSource } from "../lib/generate-submission-request-id";
import { getSubmissionRecovery, isSubmissionUncertain } from "../lib/submission-recovery";
import {
  completeQuickEstimateSubmission,
  createInitialSubmissionState,
  resetQuickEstimateSubmission,
  retryQuickEstimateSubmission,
  startQuickEstimateSubmission,
  type QuickEstimateSubmissionState,
} from "../lib/submission-state";
import type {
  QuickEstimateContactValues,
  QuickEstimateConsentValues,
  QuickEstimateFormValues,
} from "../types/quick-estimate-ui";
import type { EstimateResult } from "../types/estimate";

type FlowStep = "estimate" | "result" | "contact" | "submission";
type CalculatedEstimate = Extract<EstimateResult, { status: "calculated" }>;
type QuickEstimateFlowDependencies = {
  now?: () => number;
  randomUpliftSource?: RandomUpliftSource;
  requestIdSource?: SubmissionRequestIdSource;
  submitLead?: typeof submitEstimateLead;
};
type QuickEstimateFlowProps = {
  endpoint: string;
  consultHref: `#${string}`;
  timeoutMs?: number;
  dependencies?: QuickEstimateFlowDependencies;
};
const EMPTY_CONTACT: QuickEstimateContactValues = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
};
const EMPTY_ESTIMATE: QuickEstimateFormValues = { industryCode: "", employeeCount: "" };
const EMPTY_CONSENTS: QuickEstimateConsentValues = { privacyAgreed: false, marketingAgreed: false };

/**
 * 개인정보 없는 선조회와 명시적인 상세 견적 상담 신청을 같은 모달에서 분리합니다.
 * 결과는 조회 이벤트에서만 확정하고 전송 재시도는 최초 payload를 재사용합니다.
 */
export function QuickEstimateFlow({
  endpoint,
  consultHref,
  timeoutMs,
  dependencies = {},
}: QuickEstimateFlowProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<FlowStep>("estimate");
  const [contactValues, setContactValues] = useState(EMPTY_CONTACT);
  const [estimateValues, setEstimateValues] = useState(EMPTY_ESTIMATE);
  const [consentValues, setConsentValues] = useState(EMPTY_CONSENTS);
  const [honeypotValue, setHoneypotValue] = useState("");
  const [estimateResult, setEstimateResult] = useState<CalculatedEstimate | null>(null);
  const [localError, setLocalError] = useState("");
  const [hasUnconfirmedAttempt, setHasUnconfirmedAttempt] = useState(false);
  const [closeWarning, setCloseWarning] = useState(false);
  const [submissionState, setSubmissionState] = useState<QuickEstimateSubmissionState>(
    createInitialSubmissionState,
  );
  const submissionStateRef = useRef(submissionState);
  const submissionInFlightRef = useRef(false);
  const formOpenedAtRef = useRef(0);
  // 미확인 요청의 후속 재시도가 거절돼도 최초 저장 여부는 여전히 불명확합니다.
  const unconfirmedAttemptRef = useRef(false);

  function updateSubmissionState(state: QuickEstimateSubmissionState) {
    submissionStateRef.current = state;
    setSubmissionState(state);
  }

  function handleOpen() {
    if (submissionInFlightRef.current) return;
    setStep("estimate");
    setContactValues(EMPTY_CONTACT);
    setEstimateValues(EMPTY_ESTIMATE);
    setConsentValues(EMPTY_CONSENTS);
    setHoneypotValue("");
    setEstimateResult(null);
    setLocalError("");
    setCloseWarning(false);
    unconfirmedAttemptRef.current = false;
    setHasUnconfirmedAttempt(false);
    updateSubmissionState(createInitialSubmissionState());
    formOpenedAtRef.current = (dependencies.now ?? Date.now)();
    setOpen(true);
  }

  function handleClose() {
    if (submissionInFlightRef.current) return;
    if (unconfirmedAttemptRef.current) {
      setCloseWarning(true);
    } else {
      setOpen(false);
    }
  }

  async function performSubmission(state: QuickEstimateSubmissionState) {
    if (state.status !== "submitting" || submissionInFlightRef.current) return;
    submissionInFlightRef.current = true;
    try {
      const submitLead = dependencies.submitLead ?? submitEstimateLead;
      const result = await submitLead(state.payload, {
        endpoint,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      });
      unconfirmedAttemptRef.current = result.ok
        ? false
        : unconfirmedAttemptRef.current || isSubmissionUncertain(result);
      setHasUnconfirmedAttempt(unconfirmedAttemptRef.current);
      updateSubmissionState(completeQuickEstimateSubmission(submissionStateRef.current, result));
    } catch {
      // 전송 port가 예기치 않게 reject해도 저장 실패로 단정하거나 payload를 잃지 않습니다.
      unconfirmedAttemptRef.current = true;
      setHasUnconfirmedAttempt(true);
      updateSubmissionState(
        completeQuickEstimateSubmission(submissionStateRef.current, { ok: false, kind: "network" }),
      );
    } finally {
      submissionInFlightRef.current = false;
    }
  }

  function handleLookup() {
    if (step !== "estimate" || submissionInFlightRef.current || estimateValues.industryCode === "")
      return;
    setLocalError("");
    try {
      const calculated = calculateEstimate({
        industryCode: estimateValues.industryCode,
        employeeCount: Number(estimateValues.employeeCount),
        randomUpliftBps: generateRandomUpliftBps(dependencies.randomUpliftSource),
      });
      if (calculated.status !== "calculated") {
        setLocalError("입력 조건과 견적 기준을 확인해 주세요.");
        return;
      }
      setEstimateResult(calculated);
      setStep("result");
    } catch {
      setLocalError("예상액을 계산하지 못했습니다. 잠시 후 다시 조회해 주세요.");
    }
  }

  function handleApply() {
    if (step === "result" && endpoint.length > 0 && estimateResult) setStep("contact");
  }

  function handleSubmit() {
    if (step !== "contact" || !estimateResult || !endpoint || submissionInFlightRef.current) return;
    const currentState = submissionStateRef.current;
    if (currentState.status !== "idle") return;
    setLocalError("");
    try {
      const nextState = startQuickEstimateSubmission(
        currentState,
        {
          estimate: estimateResult,
          lead: contactValues,
          privacyAgreed: consentValues.privacyAgreed,
          marketing: {
            agreed: consentValues.marketingAgreed,
            channels: consentValues.marketingAgreed ? ["EMAIL", "SMS"] : [],
          },
          antiSpam: {
            honeypot: honeypotValue,
            elapsedMs: Math.floor((dependencies.now ?? Date.now)() - formOpenedAtRef.current),
          },
        },
        dependencies.requestIdSource,
      );
      updateSubmissionState(nextState);
      setStep("submission");
      if (nextState.status === "submitting") void performSubmission(nextState);
    } catch {
      setLocalError("신청을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  function handleRestart() {
    if (submissionInFlightRef.current || unconfirmedAttemptRef.current) return;
    updateSubmissionState(resetQuickEstimateSubmission(submissionStateRef.current));
    setEstimateResult(null);
    setLocalError("");
    setStep("estimate");
  }

  function handleRecover() {
    if (submissionInFlightRef.current) return;
    const recovery = getSubmissionRecovery(
      submissionStateRef.current,
      unconfirmedAttemptRef.current,
    );
    if (!recovery) return;
    if (recovery.action === "retry") {
      const nextState = retryQuickEstimateSubmission(submissionStateRef.current);
      updateSubmissionState(nextState);
      void performSubmission(nextState);
    } else if (recovery.action === "restart") {
      handleOpen();
    } else if (recovery.action === "lookup") {
      handleRestart();
    } else {
      updateSubmissionState(resetQuickEstimateSubmission(submissionStateRef.current));
      setStep("contact");
    }
  }

  const industry = estimateResult
    ? ESTIMATE_RULE_SET.industries.find(({ code }) => code === estimateResult.industryCode)
    : undefined;
  const summary =
    estimateResult && industry
      ? {
          amount: estimateResult.amount,
          employeeCount: estimateResult.employeeCount,
          industryLabel: industry.label,
        }
      : null;
  const title = closeWarning
    ? "접수 여부 확인 안내"
    : step === "estimate"
      ? "예상 환급액 조회"
      : step === "result"
        ? "조회 결과"
        : submissionState.status === "succeeded"
          ? "상세 견적 신청 완료"
          : "상세 견적 신청";

  return (
    <>
      <QuickEstimateHeroAction onClick={handleOpen} />
      <QuickEstimateDialog
        open={open}
        title={title}
        closeDisabled={submissionState.status === "submitting"}
        initialFocusKey={`${step}-${submissionState.status}-${closeWarning}`}
        onClose={handleClose}
      >
        {closeWarning ? (
          <div className="flex flex-col gap-5" data-dialog-initial-focus tabIndex={-1}>
            <p role="alert" className={styles.description}>
              이전 신청의 접수 여부가 확인되지 않았습니다. 닫으면 같은 요청을 다시 시도할 수 없고,
              새로 신청하면 중복 접수될 수 있습니다.
            </p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setCloseWarning(false)}
            >
              돌아가서 접수 확인
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>
              접수 여부 미확인 상태로 닫기
            </button>
          </div>
        ) : (
          <>
            {localError ? (
              <p role="alert" className={styles.feedbackError}>
                {localError}
              </p>
            ) : null}
            {step === "estimate" ? (
              <QuickEstimateEstimateStep
                values={estimateValues}
                onChange={(field, value) =>
                  setEstimateValues((current) => ({ ...current, [field]: value }))
                }
                onLookup={handleLookup}
              />
            ) : null}
            {step === "result" && summary ? (
              <QuickEstimateResultStep
                {...summary}
                onApply={endpoint ? handleApply : null}
                onRestart={handleRestart}
                onConsult={() => {
                  setOpen(false);
                  window.location.hash = consultHref;
                }}
              />
            ) : null}
            {step === "contact" && summary ? (
              <div className="flex flex-col gap-6">
                <p className={styles.description}>
                  상세 견적 상담을 위해 회사와 담당자 정보를 입력해 주세요.
                </p>
                <QuickEstimateSummary {...summary} />
                <QuickEstimateContactStep
                  values={contactValues}
                  consentValues={consentValues}
                  honeypotValue={honeypotValue}
                  onHoneypotChange={setHoneypotValue}
                  onChange={(field, value) =>
                    setContactValues((current) => ({ ...current, [field]: value }))
                  }
                  onConsentChange={(field, value) =>
                    setConsentValues((current) => ({ ...current, [field]: value }))
                  }
                  onSubmit={handleSubmit}
                  onBack={() => {
                    setLocalError("");
                    setStep("result");
                  }}
                />
              </div>
            ) : null}
            {step === "submission" && summary ? (
              <QuickEstimateSubmissionStep
                summary={summary}
                state={submissionState}
                recovery={getSubmissionRecovery(submissionState, hasUnconfirmedAttempt)}
                onRecover={handleRecover}
                onClose={handleClose}
              />
            ) : null}
          </>
        )}
      </QuickEstimateDialog>
    </>
  );
}
