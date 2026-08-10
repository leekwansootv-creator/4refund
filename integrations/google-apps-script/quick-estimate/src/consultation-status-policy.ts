import { LEAD_STATUSES } from "./sheet-schema";
import {
  CONSULTATION_RESULT_OPTIONS,
  CONSULTATION_STATUS_LABELS,
  type ConsultationSheetCell,
} from "./consultation-sheet-schema";

/** 원본 leads에 저장하는 상담 상태 코드입니다. */
export type ConsultationStatusCode = (typeof LEAD_STATUSES)[number];

/** 상담 목록에 표시하는 한글 상담 상태입니다. */
export type ConsultationStatusLabel = (typeof CONSULTATION_STATUS_LABELS)[ConsultationStatusCode];

/** 상담 목록에서 선택할 수 있는 한글 상담 결과입니다. */
export type ConsultationResult = (typeof CONSULTATION_RESULT_OPTIONS)[number];

/** 상태 전이 판단에 필요한 현재값, 변경값, 결과와 소유자 여부입니다. */
export type ConsultationStatusTransitionInput = {
  previousStatus: string;
  nextStatus: string;
  result: string;
  editorIsOwner: boolean;
};

/** 한글 입력 검증의 성공 또는 담당자에게 표시할 실패 사유입니다. */
export type ConsultationValidationResult<Value> =
  | { ok: true; value: Value }
  | {
      ok: false;
      code:
        | "INVALID_ASSIGNEE"
        | "INVALID_NEXT_CONTACT_AT"
        | "INVALID_RESULT"
        | "INVALID_STATUS"
        | "INVALID_TRANSITION"
        | "OWNER_REQUIRED"
        | "RESULT_REQUIRED";
      message: string;
    };

const STATUS_CODES_BY_LABEL = new Map<ConsultationStatusLabel, ConsultationStatusCode>(
  LEAD_STATUSES.map((status) => [CONSULTATION_STATUS_LABELS[status], status]),
);
const NEW_TO_CLOSED_RESULTS = new Set<ConsultationResult>(["연락처 오류", "중복 신청"]);
const CONTACTING_TO_CLOSED_RESULTS = new Set<ConsultationResult>([
  "상담 거절",
  "연락처 오류",
  "중복 신청",
]);
const ASSIGNEE_PATTERN = /^[가-힣A-Za-z][가-힣A-Za-z\s·-]{0,29}$/u;

function getStatusCode(value: string): ConsultationStatusCode | null {
  return STATUS_CODES_BY_LABEL.get(value as ConsultationStatusLabel) ?? null;
}

function isConsultationResult(value: string): value is ConsultationResult {
  return CONSULTATION_RESULT_OPTIONS.some((option) => option === value);
}

/** 한글 상담 상태의 허용 전이와 결과 필수 조건을 검증합니다. */
export function validateConsultationStatusTransition(
  input: ConsultationStatusTransitionInput,
): ConsultationValidationResult<ConsultationStatusCode> {
  const previousCode = getStatusCode(input.previousStatus);
  const nextCode = getStatusCode(input.nextStatus);

  if (previousCode === null || nextCode === null) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "상담 상태는 지정된 한글 선택값만 사용할 수 있습니다.",
    };
  }

  if (previousCode === nextCode) {
    return { ok: true, value: nextCode };
  }

  if (previousCode === "NEW" && nextCode === "CONTACTING") {
    return { ok: true, value: nextCode };
  }

  if (previousCode === "NEW" && nextCode === "CLOSED") {
    if (!isConsultationResult(input.result) || !NEW_TO_CLOSED_RESULTS.has(input.result)) {
      return {
        ok: false,
        code: "RESULT_REQUIRED",
        message: "신규 신청을 종결하려면 연락처 오류 또는 중복 신청을 선택해 주세요.",
      };
    }

    return { ok: true, value: nextCode };
  }

  if (previousCode === "CONTACTING" && nextCode === "COMPLETED") {
    if (input.result !== "상담 완료") {
      return {
        ok: false,
        code: "RESULT_REQUIRED",
        message: "상담을 완료하려면 상담 결과에서 상담 완료를 선택해 주세요.",
      };
    }

    return { ok: true, value: nextCode };
  }

  if (previousCode === "CONTACTING" && nextCode === "CLOSED") {
    if (!isConsultationResult(input.result) || !CONTACTING_TO_CLOSED_RESULTS.has(input.result)) {
      return {
        ok: false,
        code: "RESULT_REQUIRED",
        message: "연락 중 상담을 종결하려면 상담 거절, 연락처 오류 또는 중복 신청을 선택해 주세요.",
      };
    }

    return { ok: true, value: nextCode };
  }

  if ((previousCode === "COMPLETED" || previousCode === "CLOSED") && nextCode === "CONTACTING") {
    if (!input.editorIsOwner) {
      return {
        ok: false,
        code: "OWNER_REQUIRED",
        message: "완료하거나 종결한 상담의 재개는 Sheet 소유자만 할 수 있습니다.",
      };
    }

    return { ok: true, value: nextCode };
  }

  return {
    ok: false,
    code: "INVALID_TRANSITION",
    message: "현재 상태에서 선택한 상태로 변경할 수 없습니다.",
  };
}

/** 상담 결과값과 완료·종결 상태의 필수 결과 조합을 검증합니다. */
export function validateConsultationResult(
  value: string,
  currentStatus: string,
): ConsultationValidationResult<ConsultationResult> {
  if (!isConsultationResult(value)) {
    return {
      ok: false,
      code: "INVALID_RESULT",
      message: "상담 결과는 지정된 한글 선택값만 사용할 수 있습니다.",
    };
  }

  if (currentStatus === CONSULTATION_STATUS_LABELS.COMPLETED && value !== "상담 완료") {
    return {
      ok: false,
      code: "RESULT_REQUIRED",
      message: "상담 완료 상태에서는 상담 결과도 상담 완료여야 합니다.",
    };
  }

  if (
    currentStatus === CONSULTATION_STATUS_LABELS.CLOSED &&
    !CONTACTING_TO_CLOSED_RESULTS.has(value)
  ) {
    return {
      ok: false,
      code: "RESULT_REQUIRED",
      message: "종결 상태에서는 종결 사유에 맞는 상담 결과를 선택해 주세요.",
    };
  }

  return { ok: true, value };
}

/** 상담 담당자 이름을 공백 제거 후 허용 문자와 30자 제한으로 검증합니다. */
export function validateConsultationAssignee(value: string): ConsultationValidationResult<string> {
  const normalized = value.trim().replace(/\s+/gu, " ");

  if (normalized === "") {
    return { ok: true, value: "" };
  }

  if (!ASSIGNEE_PATTERN.test(normalized)) {
    return {
      ok: false,
      code: "INVALID_ASSIGNEE",
      message: "상담 담당자는 30자 이내의 이름만 입력해 주세요.",
    };
  }

  return { ok: true, value: normalized };
}

/** 다음 연락 예정일을 빈 값 또는 유효한 날짜 객체로 제한합니다. */
export function validateNextContactAt(
  value: unknown,
): ConsultationValidationResult<ConsultationSheetCell | Date> {
  if (value === "" || value === null) {
    return { ok: true, value: "" };
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return { ok: true, value };
  }

  return {
    ok: false,
    code: "INVALID_NEXT_CONTACT_AT",
    message: "다음 연락 예정일은 올바른 날짜와 시각으로 입력해 주세요.",
  };
}

/** 한글 상담 상태를 원본 leads 상태 코드로 변환합니다. */
export function getConsultationStatusCode(value: string): ConsultationStatusCode | null {
  return getStatusCode(value);
}
