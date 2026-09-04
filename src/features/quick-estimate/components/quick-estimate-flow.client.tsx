"use client";

import { useRef, useState } from "react";

import { QuickEstimateContactStep } from "./contact-step";
import { QuickEstimateResultStep } from "./estimate-result-step";
import { QuickEstimateEstimateStep } from "./estimate-step";
import { QuickEstimateDialog } from "./quick-estimate-dialog";
import { QuickEstimateHeroAction } from "./quick-estimate-hero-action";
import { submitEstimateLead } from "../api/submit-estimate-lead";
import { ESTIMATE_RULE_SET } from "../constants/estimate-rule-set";
import { calculateEstimate } from "../lib/calculate-estimate";
import { generateRandomUpliftBps, type RandomUpliftSource } from "../lib/generate-random-uplift";
import type { SubmissionRequestIdSource } from "../lib/generate-submission-request-id";
import {
  completeQuickEstimateSubmission,
  createInitialSubmissionState,
  resetQuickEstimateSubmission,
  retryQuickEstimateSubmission,
  startQuickEstimateSubmission,
  type QuickEstimateSubmissionState,
} from "../lib/submission-state";
import type { QuickEstimateSubmissionTransportResult } from "../types/lead-submission";
import type {
  QuickEstimateContactValues,
  QuickEstimateConsentValues,
  QuickEstimateFormValues,
  QuickEstimateResultFeedback,
} from "../types/quick-estimate-ui";
import type { EstimateResult } from "../types/estimate";

type QuickEstimateFlowStep = "contact" | "estimate" | "result";
type CalculatedEstimate = Extract<EstimateResult, { status: "calculated" }>;
type SubmissionFailure = Exclude<QuickEstimateSubmissionTransportResult, { ok: true }>;

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

const EMPTY_CONTACT_VALUES: QuickEstimateContactValues = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
};

const EMPTY_ESTIMATE_VALUES: QuickEstimateFormValues = {
  industryCode: "",
  employeeCount: "",
};

const EMPTY_CONSENT_VALUES: QuickEstimateConsentValues = {
  privacyAgreed: false,
  marketingAgreed: false,
};

function getSubmissionFailureMessage(failure: SubmissionFailure): string {
  switch (failure.kind) {
    case "timeout":
      return "접수 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.";
    case "network":
      return "네트워크 연결을 확인한 뒤 같은 내용으로 다시 시도해 주세요.";
    case "unreadable_response":
      return "접수 응답을 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.";
    case "server":
      if (failure.code === "RATE_LIMITED") {
        return "신청이 많아 잠시 접수를 제한하고 있습니다. 잠시 후 다시 시도해 주세요.";
      }

      return failure.code === "STORAGE_UNAVAILABLE"
        ? "상담 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : "일시적인 오류로 상담 신청을 저장하지 못했습니다. 다시 시도해 주세요.";
    case "validation":
      switch (failure.code) {
        case "INVALID_CONSENT":
          return "동의 정보를 확인하지 못했습니다. 다시 조회해 주세요.";
        case "UNSUPPORTED_RULE":
          return "견적 기준이 변경되었습니다. 다시 조회해 주세요.";
        case "INVALID_INPUT":
          return "입력 정보를 확인하지 못했습니다. 다시 조회해 주세요.";
      }
  }
}

function getDialogTitle(step: QuickEstimateFlowStep): string {
  switch (step) {
    case "contact":
      return "정보를 입력해 주세요";
    case "estimate":
      return "예상 환급액 조회";
    case "result":
      return "조회 결과";
  }
}

/**
 * 간단 견적 CTA부터 연락처·계산·Apps Script 제출 결과까지 한 dialog 흐름으로 연결합니다.
 *
 * 운영 endpoint는 공개 URL이라도 소스에 고정하지 않고 배포 경계에서 주입합니다.
 * 저장 실패 재시도에서는 최초 payload를 보존해 금액·난수·request_id가 바뀌지 않습니다.
 */
export function QuickEstimateFlow({
  endpoint,
  consultHref,
  timeoutMs,
  dependencies = {},
}: QuickEstimateFlowProps) {
  const isAvailable = endpoint.length > 0;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<QuickEstimateFlowStep>("contact");
  const [contactValues, setContactValues] =
    useState<QuickEstimateContactValues>(EMPTY_CONTACT_VALUES);
  const [honeypotValue, setHoneypotValue] = useState("");
  const [estimateValues, setEstimateValues] =
    useState<QuickEstimateFormValues>(EMPTY_ESTIMATE_VALUES);
  const [consentValues, setConsentValues] =
    useState<QuickEstimateConsentValues>(EMPTY_CONSENT_VALUES);
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(null);
  const [submissionState, setSubmissionState] = useState<QuickEstimateSubmissionState>(() =>
    createInitialSubmissionState(),
  );
  const submissionStateRef = useRef(submissionState);
  const submissionInFlightRef = useRef(false);
  const formOpenedAtRef = useRef(0);

  function updateSubmissionState(nextState: QuickEstimateSubmissionState) {
    submissionStateRef.current = nextState;
    setSubmissionState(nextState);
  }

  function handleOpen() {
    if (!isAvailable) {
      return;
    }

    const now = dependencies.now ?? Date.now;

    setStep("contact");
    setContactValues(EMPTY_CONTACT_VALUES);
    setHoneypotValue("");
    setEstimateValues(EMPTY_ESTIMATE_VALUES);
    setConsentValues(EMPTY_CONSENT_VALUES);
    setEstimateResult(null);
    updateSubmissionState(createInitialSubmissionState());
    formOpenedAtRef.current = now();
    setOpen(true);
  }

  function handleClose() {
    if (!submissionInFlightRef.current) {
      setOpen(false);
    }
  }

  async function performSubmission(submittingState: QuickEstimateSubmissionState) {
    if (submittingState.status !== "submitting" || submissionInFlightRef.current) {
      return;
    }

    submissionInFlightRef.current = true;

    try {
      const submitLead = dependencies.submitLead ?? submitEstimateLead;
      const result = await submitLead(submittingState.payload, {
        endpoint,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      });
      const currentState = submissionStateRef.current;

      if (
        currentState.status === "submitting" &&
        currentState.payload.requestId === submittingState.payload.requestId
      ) {
        updateSubmissionState(completeQuickEstimateSubmission(currentState, result));
      }
    } finally {
      submissionInFlightRef.current = false;
    }
  }

  function handleContactChange(field: keyof QuickEstimateContactValues, value: string) {
    setContactValues((current) => ({ ...current, [field]: value }));
  }

  function handleEstimateChange<Field extends keyof QuickEstimateFormValues>(
    field: Field,
    value: QuickEstimateFormValues[Field],
  ) {
    setEstimateValues((current) => ({ ...current, [field]: value }));
  }

  function handleConsentChange(field: keyof QuickEstimateConsentValues, value: boolean) {
    setConsentValues((current) => ({ ...current, [field]: value }));
  }

  function startSubmission(calculated: CalculatedEstimate) {
    if (submissionInFlightRef.current) {
      return;
    }

    const now = dependencies.now ?? Date.now;
    const nextSubmissionState = startQuickEstimateSubmission(
      createInitialSubmissionState(),
      {
        estimate: calculated,
        lead: contactValues,
        privacyAgreed: consentValues.privacyAgreed,
        marketing: {
          agreed: consentValues.marketingAgreed,
          channels: consentValues.marketingAgreed ? ["EMAIL", "SMS"] : [],
        },
        antiSpam: {
          honeypot: honeypotValue,
          elapsedMs: Math.max(0, Math.floor(now() - formOpenedAtRef.current)),
        },
      },
      dependencies.requestIdSource,
    );

    updateSubmissionState(nextSubmissionState);
    setStep("result");

    if (nextSubmissionState.status === "submitting") {
      void performSubmission(nextSubmissionState);
    }
  }

  function handleContactNext() {
    if (estimateResult?.status === "calculated") {
      startSubmission(estimateResult);
      return;
    }

    setStep("estimate");
  }

  function handleLookup() {
    if (submissionInFlightRef.current || estimateValues.industryCode === "") {
      return;
    }

    const employeeCount = Number(estimateValues.employeeCount);
    const calculated = calculateEstimate({
      industryCode: estimateValues.industryCode,
      employeeCount,
      randomUpliftBps: generateRandomUpliftBps(dependencies.randomUpliftSource),
    });

    if (calculated.status !== "calculated") {
      return;
    }

    setEstimateResult(calculated);
    startSubmission(calculated);
  }

  function handleRetry() {
    if (submissionInFlightRef.current) {
      return;
    }

    const nextSubmissionState = retryQuickEstimateSubmission(submissionStateRef.current);

    if (nextSubmissionState.status === "submitting") {
      updateSubmissionState(nextSubmissionState);
      void performSubmission(nextSubmissionState);
    }
  }

  function handleRestart() {
    if (submissionInFlightRef.current) {
      return;
    }

    updateSubmissionState(resetQuickEstimateSubmission(submissionStateRef.current));
    setEstimateResult(null);
    setStep("estimate");
  }

  function handleEditContact() {
    if (submissionInFlightRef.current) {
      return;
    }

    updateSubmissionState(resetQuickEstimateSubmission(submissionStateRef.current));
    setStep("contact");
  }

  function handleConsult() {
    if (submissionInFlightRef.current) {
      return;
    }

    setOpen(false);
    window.location.hash = consultHref;
  }

  let feedback: QuickEstimateResultFeedback = { status: "idle" };

  if (submissionState.status === "submitting") {
    feedback = { status: "submitting" };
  } else if (submissionState.status === "succeeded") {
    feedback = { status: "succeeded" };
  } else if (submissionState.status === "failed" && submissionState.phase === "submission") {
    feedback = {
      status: "failed",
      message: getSubmissionFailureMessage(submissionState.failure),
      onEditContact: handleEditContact,
      onRetry: handleRetry,
    };
  } else if (submissionState.status === "failed") {
    feedback = {
      status: "failed",
      message: "입력 정보를 확인하지 못했습니다. 다시 조회해 주세요.",
      onEditContact: handleEditContact,
      onRetry: handleRestart,
    };
  }

  const industry =
    estimateResult?.status === "calculated"
      ? ESTIMATE_RULE_SET.industries.find(({ code }) => code === estimateResult.industryCode)
      : undefined;

  return (
    <>
      <QuickEstimateHeroAction
        aria-describedby={!isAvailable ? "quick-estimate-unavailable" : undefined}
        disabled={!isAvailable}
        onClick={handleOpen}
      />
      {!isAvailable ? (
        <span id="quick-estimate-unavailable" className="sr-only">
          간단 견적 접수 환경을 준비하고 있습니다.
        </span>
      ) : null}
      <QuickEstimateDialog
        open={open}
        title={getDialogTitle(step)}
        titleVariant={step === "contact" ? "contact" : "estimate"}
        closeDisabled={submissionState.status === "submitting"}
        initialFocusKey={step}
        onClose={handleClose}
      >
        {step === "contact" ? (
          <QuickEstimateContactStep
            values={contactValues}
            honeypotValue={honeypotValue}
            onChange={handleContactChange}
            onHoneypotChange={setHoneypotValue}
            onNext={handleContactNext}
          />
        ) : null}

        {step === "estimate" ? (
          <QuickEstimateEstimateStep
            values={estimateValues}
            consentValues={consentValues}
            onConsentChange={handleConsentChange}
            onChange={handleEstimateChange}
            onLookup={handleLookup}
          />
        ) : null}

        {step === "result" && estimateResult?.status === "calculated" && industry ? (
          <QuickEstimateResultStep
            amount={estimateResult.amount}
            employeeCount={estimateResult.employeeCount}
            industryLabel={industry.label}
            feedback={feedback}
            onConsult={handleConsult}
            onRestart={handleRestart}
          />
        ) : null}
      </QuickEstimateDialog>
    </>
  );
}
