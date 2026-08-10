import {
  getConsultationStatusCode,
  validateConsultationAssignee,
  validateConsultationResult,
  validateConsultationStatusTransition,
  validateNextContactAt,
  type ConsultationStatusCode,
} from "./consultation-status-policy";
import { CONSULTATION_COLUMN_NUMBERS, formatKoreanDateTime } from "./consultation-sheet-schema";

/** 원본 leads에서 상태 동기화에 필요한 최소 행 정보입니다. */
export type ConsultationLeadStatusRecord = {
  rowNumber: number;
  statusCode: string;
  handledAt: string;
};

/** 상담 목록 한 셀 편집을 검증할 때 사용하는 현재 행 정보입니다. */
export type ConsultationCellEditInput = {
  columnNumber: number;
  previousDisplayValue: string;
  currentDisplayValue: string;
  currentValue: unknown;
  rowValues: readonly unknown[];
  editorIsOwner: boolean;
};

/** 상담 편집 검증과 원본 동기화의 Sheet 부수 효과입니다. */
export type ConsultationCellEditDependencies = {
  findLeadById: (leadId: string) => ConsultationLeadStatusRecord | null;
  updateLeadStatus: (
    rowNumber: number,
    statusCode: ConsultationStatusCode,
    handledAt: string,
  ) => void;
  setFirstContactAt: (displayValue: string) => void;
  setEditedValue: (value: unknown) => void;
  setEditedCellNote: (note: string | null) => void;
  now: () => Date;
};

/** 상담 편집 처리 여부와 공개 가능한 실패 코드입니다. */
export type ConsultationCellEditResult =
  | { handled: false; ok: true }
  | { handled: true; ok: true }
  | {
      handled: true;
      ok: false;
      code:
        | "INVALID_ASSIGNEE"
        | "INVALID_NEXT_CONTACT_AT"
        | "INVALID_RESULT"
        | "INVALID_STATUS"
        | "INVALID_TRANSITION"
        | "LEAD_NOT_FOUND"
        | "LEAD_STATUS_MISMATCH"
        | "LEAD_SYNC_FAILED"
        | "MISSING_LEAD_ID"
        | "OWNER_REQUIRED"
        | "RESULT_REQUIRED";
    };

type ConsultationCellEditFailureCode = Extract<ConsultationCellEditResult, { ok: false }>["code"];

const STATUS_INDEX = CONSULTATION_COLUMN_NUMBERS.status - 1;
const RESULT_INDEX = CONSULTATION_COLUMN_NUMBERS.result - 1;
const LEAD_ID_INDEX = CONSULTATION_COLUMN_NUMBERS.leadId - 1;

function rejectAndRestore(
  input: ConsultationCellEditInput,
  dependencies: ConsultationCellEditDependencies,
  failure: { code: ConsultationCellEditFailureCode; message: string },
): ConsultationCellEditResult {
  dependencies.setEditedValue(input.previousDisplayValue);
  dependencies.setEditedCellNote(failure.message);

  return {
    handled: true,
    ok: false,
    code: failure.code,
  };
}

function markLeadSyncPending(
  dependencies: ConsultationCellEditDependencies,
  code: "LEAD_NOT_FOUND" | "LEAD_STATUS_MISMATCH" | "LEAD_SYNC_FAILED",
  reason: string,
): ConsultationCellEditResult {
  dependencies.setEditedCellNote(`원본 반영 대기: ${reason}`);

  return { handled: true, ok: false, code };
}

function handleStatusEdit(
  input: ConsultationCellEditInput,
  dependencies: ConsultationCellEditDependencies,
): ConsultationCellEditResult {
  const result = String(input.rowValues[RESULT_INDEX] ?? "");
  const transition = validateConsultationStatusTransition({
    previousStatus: input.previousDisplayValue,
    nextStatus: input.currentDisplayValue,
    result,
    editorIsOwner: input.editorIsOwner,
  });

  if (!transition.ok) {
    return rejectAndRestore(input, dependencies, transition);
  }

  const leadId = String(input.rowValues[LEAD_ID_INDEX] ?? "").trim();

  if (leadId === "") {
    return rejectAndRestore(input, dependencies, {
      code: "MISSING_LEAD_ID",
      message: "상담 신청 번호가 없어 상태를 변경할 수 없습니다.",
    });
  }

  try {
    const lead = dependencies.findLeadById(leadId);

    if (lead === null) {
      return markLeadSyncPending(
        dependencies,
        "LEAD_NOT_FOUND",
        "일치하는 원본 상담 신청을 찾지 못했습니다.",
      );
    }

    const previousStatusCode = getConsultationStatusCode(input.previousDisplayValue);

    if (lead.statusCode !== previousStatusCode && lead.statusCode !== transition.value) {
      return markLeadSyncPending(
        dependencies,
        "LEAD_STATUS_MISMATCH",
        "원본 상담 상태가 현재 화면과 다릅니다.",
      );
    }

    const shouldSetFirstContact = transition.value === "CONTACTING" && lead.handledAt === "";
    const handledAt = shouldSetFirstContact ? dependencies.now().toISOString() : lead.handledAt;

    dependencies.updateLeadStatus(lead.rowNumber, transition.value, handledAt);

    if (shouldSetFirstContact) {
      dependencies.setFirstContactAt(formatKoreanDateTime(handledAt));
    }

    dependencies.setEditedCellNote(null);

    return { handled: true, ok: true };
  } catch {
    return markLeadSyncPending(
      dependencies,
      "LEAD_SYNC_FAILED",
      "원본 저장 중 오류가 발생했습니다. 소유자에게 알려 주세요.",
    );
  }
}

/** 상담 목록의 허용 운영 컬럼을 검증하고 상태 변경을 원본 leads에 동기화합니다. */
export function handleConsultationCellEdit(
  input: ConsultationCellEditInput,
  dependencies: ConsultationCellEditDependencies,
): ConsultationCellEditResult {
  if (input.columnNumber === CONSULTATION_COLUMN_NUMBERS.status) {
    return handleStatusEdit(input, dependencies);
  }

  if (input.columnNumber === CONSULTATION_COLUMN_NUMBERS.assignee) {
    const validation = validateConsultationAssignee(input.currentDisplayValue);

    if (!validation.ok) {
      return rejectAndRestore(input, dependencies, validation);
    }

    dependencies.setEditedValue(validation.value);
    dependencies.setEditedCellNote(null);

    return { handled: true, ok: true };
  }

  if (input.columnNumber === CONSULTATION_COLUMN_NUMBERS.nextContactAt) {
    const validation = validateNextContactAt(input.currentValue);

    if (!validation.ok) {
      return rejectAndRestore(input, dependencies, validation);
    }

    dependencies.setEditedCellNote(null);

    return { handled: true, ok: true };
  }

  if (input.columnNumber === CONSULTATION_COLUMN_NUMBERS.result) {
    const validation = validateConsultationResult(
      input.currentDisplayValue,
      String(input.rowValues[STATUS_INDEX] ?? ""),
    );

    if (!validation.ok) {
      return rejectAndRestore(input, dependencies, validation);
    }

    dependencies.setEditedCellNote(null);

    return { handled: true, ok: true };
  }

  return { handled: false, ok: true };
}
