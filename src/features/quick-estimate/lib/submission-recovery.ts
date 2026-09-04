import type { QuickEstimateSubmissionState } from "./submission-state";
import type { QuickEstimateSubmissionTransportResult } from "../types/lead-submission";
import {
  MAX_SUBMISSION_ELAPSED_MS,
  MIN_SUBMISSION_ELAPSED_MS,
} from "../constants/lead-submission-contract";

/** 실패 뒤 허용할 행동을 기존 요청의 저장 확실성과 입력 검증에 따라 구분합니다. */
export type SubmissionRecovery = {
  message: string;
  action: "retry" | "edit" | "lookup" | "restart";
  label: string;
};

/** 네트워크 단절과 내부 오류는 저장 전후를 구분할 증거가 없으므로 미확인으로 취급합니다. */
export function isSubmissionUncertain(result: QuickEstimateSubmissionTransportResult): boolean {
  return (
    !result.ok &&
    (result.kind === "timeout" ||
      result.kind === "network" ||
      result.kind === "unreadable_response" ||
      (result.kind === "server" && result.code === "INTERNAL_ERROR"))
  );
}

/** 최초 표시한 견적과 전송 payload를 보존하는 오류별 복구 안내를 선택합니다. */
export function getSubmissionRecovery(
  state: QuickEstimateSubmissionState,
  hasUnconfirmedAttempt: boolean,
): SubmissionRecovery | null {
  if (state.status !== "failed") return null;
  if (hasUnconfirmedAttempt)
    return {
      message:
        "접수 결과를 확인하지 못했습니다. 이미 저장되었을 수 있으니 같은 내용으로 다시 시도해 주세요.",
      action: "retry",
      label: "접수 다시 시도",
    };
  if (state.phase === "validation") {
    if (state.draft.antiSpam.elapsedMs > MAX_SUBMISSION_ELAPSED_MS)
      return {
        message: "입력 가능 시간이 지났습니다. 처음부터 다시 시작해 주세요.",
        action: "restart",
        label: "처음부터 다시 시작",
      };
    if (state.draft.antiSpam.elapsedMs < MIN_SUBMISSION_ELAPSED_MS)
      return {
        message: "입력 내용을 확인하고 잠시 후 신청해 주세요.",
        action: "edit",
        label: "신청 정보 확인",
      };
    if (state.issues.includes("invalid_estimate"))
      return {
        message: "견적 기준을 확인하지 못했습니다. 다시 조회해 주세요.",
        action: "lookup",
        label: "다시 조회하기",
      };
    return {
      message: "입력 정보와 동의를 확인해 주세요.",
      action: "edit",
      label: "신청 정보 확인",
    };
  }
  const failure = state.failure;
  if (failure.kind === "validation") {
    if (failure.code === "UNSUPPORTED_RULE")
      return {
        message: "견적 기준이 변경되었습니다. 다시 조회해 주세요.",
        action: "lookup",
        label: "다시 조회하기",
      };
    return {
      message:
        failure.code === "INVALID_CONSENT"
          ? "동의 정보를 확인해 주세요."
          : "입력 정보를 확인해 주세요.",
      action: "edit",
      label: "신청 정보 확인",
    };
  }
  return {
    message:
      failure.kind === "server" && failure.code === "RATE_LIMITED"
        ? "신청이 많아 잠시 접수를 제한하고 있습니다. 잠시 후 다시 시도해 주세요."
        : "상담 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    action: "retry",
    label: "접수 다시 시도",
  };
}
