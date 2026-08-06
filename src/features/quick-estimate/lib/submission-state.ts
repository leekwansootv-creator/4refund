import { createQuickEstimateSubmissionPayload } from "../schemas/lead-submission";
import type {
  QuickEstimateLeadDraft,
  QuickEstimateLeadValidationIssue,
  QuickEstimateSubmissionPayload,
  QuickEstimateSubmissionTransportResult,
} from "../types/lead-submission";
import {
  generateSubmissionRequestId,
  type SubmissionRequestIdSource,
} from "./generate-submission-request-id";

type SubmissionTransportFailure = Exclude<QuickEstimateSubmissionTransportResult, { ok: true }>;

/** UI 단계와 독립적으로 상담 제출의 진행·성공·실패 정보를 보존하는 상태입니다. */
export type QuickEstimateSubmissionState =
  | {
      status: "idle";
    }
  | {
      status: "submitting";
      payload: QuickEstimateSubmissionPayload;
    }
  | {
      status: "succeeded";
      payload: QuickEstimateSubmissionPayload;
      leadId: string;
      duplicate: boolean;
    }
  | {
      status: "failed";
      phase: "validation";
      draft: QuickEstimateLeadDraft;
      issues: QuickEstimateLeadValidationIssue[];
    }
  | {
      status: "failed";
      phase: "submission";
      payload: QuickEstimateSubmissionPayload;
      failure: SubmissionTransportFailure;
    };

/** 아직 전송을 시작하지 않은 초기 상담 제출 상태를 만듭니다. */
export function createInitialSubmissionState(): QuickEstimateSubmissionState {
  return { status: "idle" };
}

/** 제출 가능한 상태에서 request_id를 한 번 생성하고 검증된 요청을 진행 상태로 고정합니다. */
export function startQuickEstimateSubmission(
  state: QuickEstimateSubmissionState,
  draft: QuickEstimateLeadDraft,
  requestIdSource?: SubmissionRequestIdSource,
): QuickEstimateSubmissionState {
  if (
    state.status === "submitting" ||
    state.status === "succeeded" ||
    (state.status === "failed" && state.phase === "submission")
  ) {
    return state;
  }

  const requestId = generateSubmissionRequestId(requestIdSource);
  const validation = createQuickEstimateSubmissionPayload(draft, requestId);

  if (!validation.ok) {
    return {
      status: "failed",
      phase: "validation",
      draft,
      issues: validation.issues,
    };
  }

  return {
    status: "submitting",
    payload: validation.payload,
  };
}

/** 진행 중 요청에 판독된 전송 결과를 적용하고 성공 또는 실패 상태로 전환합니다. */
export function completeQuickEstimateSubmission(
  state: QuickEstimateSubmissionState,
  result: QuickEstimateSubmissionTransportResult,
): QuickEstimateSubmissionState {
  if (state.status !== "submitting") {
    return state;
  }

  if (result.ok) {
    return {
      status: "succeeded",
      payload: state.payload,
      leadId: result.leadId,
      duplicate: result.duplicate,
    };
  }

  return {
    status: "failed",
    phase: "submission",
    payload: state.payload,
    failure: result,
  };
}

/** 전송 실패 요청을 새 식별자나 새 계산 없이 같은 payload로 다시 진행합니다. */
export function retryQuickEstimateSubmission(
  state: QuickEstimateSubmissionState,
): QuickEstimateSubmissionState {
  if (state.status !== "failed" || state.phase !== "submission") {
    return state;
  }

  return {
    status: "submitting",
    payload: state.payload,
  };
}

/** 진행 중 요청은 보존하고 완료 또는 실패한 흐름만 새 작업을 위해 초기화합니다. */
export function resetQuickEstimateSubmission(
  state: QuickEstimateSubmissionState,
): QuickEstimateSubmissionState {
  return state.status === "submitting" ? state : createInitialSubmissionState();
}
