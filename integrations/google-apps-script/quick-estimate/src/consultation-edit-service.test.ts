import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleConsultationCellEdit,
  type ConsultationCellEditDependencies,
  type ConsultationCellEditInput,
} from "./consultation-edit-service";
import { CONSULTATION_COLUMN_NUMBERS } from "./consultation-sheet-schema";

const NOW = new Date("2026-08-10T03:04:05.000Z");

function createInput(
  overrides: Partial<ConsultationCellEditInput> = {},
): ConsultationCellEditInput {
  const rowValues = Array.from({ length: 16 }, () => "");

  rowValues[0] = "연락 중";
  rowValues[12] = "미입력";
  rowValues[15] = "lead-a";

  return {
    columnNumber: CONSULTATION_COLUMN_NUMBERS.status,
    previousDisplayValue: "신규 신청",
    currentDisplayValue: "연락 중",
    currentValue: "연락 중",
    rowValues,
    editorIsOwner: false,
    ...overrides,
  };
}

function createDependencies(overrides: Partial<ConsultationCellEditDependencies> = {}) {
  const updateLeadStatus = vi.fn();
  const setFirstContactAt = vi.fn();
  const setEditedValue = vi.fn();
  const setEditedCellNote = vi.fn();
  const dependencies: ConsultationCellEditDependencies = {
    findLeadById: () => ({ rowNumber: 2, statusCode: "NEW", handledAt: "" }),
    updateLeadStatus,
    setFirstContactAt,
    setEditedValue,
    setEditedCellNote,
    now: () => NOW,
    ...overrides,
  };

  return {
    dependencies,
    updateLeadStatus,
    setFirstContactAt,
    setEditedValue,
    setEditedCellNote,
  };
}

describe("handleConsultationCellEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("신규 신청을 연락 중으로 바꾸면 원본 상태와 최초 연락 시각을 함께 기록한다", () => {
    const { dependencies, updateLeadStatus, setFirstContactAt, setEditedCellNote } =
      createDependencies();

    const result = handleConsultationCellEdit(createInput(), dependencies);

    expect(result).toEqual({ handled: true, ok: true });
    expect(updateLeadStatus).toHaveBeenCalledWith(2, "CONTACTING", NOW.toISOString());
    expect(setFirstContactAt).toHaveBeenCalledWith("2026. 08. 10. 오후 12:04");
    expect(setEditedCellNote).toHaveBeenCalledWith(null);
  });

  it("최초 연락 시각이 이미 있으면 상태 변경 뒤에도 덮어쓰지 않는다", () => {
    const { dependencies, updateLeadStatus, setFirstContactAt } = createDependencies({
      findLeadById: () => ({
        rowNumber: 4,
        statusCode: "COMPLETED",
        handledAt: "2026-08-09T01:00:00.000Z",
      }),
    });
    const rowValues = Array.from({ length: 16 }, () => "");

    rowValues[0] = "연락 중";
    rowValues[12] = "다시 연락 요청";
    rowValues[15] = "lead-b";

    const result = handleConsultationCellEdit(
      createInput({
        previousDisplayValue: "상담 완료",
        rowValues,
        editorIsOwner: true,
      }),
      dependencies,
    );

    expect(result).toEqual({ handled: true, ok: true });
    expect(updateLeadStatus).toHaveBeenCalledWith(4, "CONTACTING", "2026-08-09T01:00:00.000Z");
    expect(setFirstContactAt).not.toHaveBeenCalled();
  });

  it("허용되지 않은 상태 전이는 이전 값으로 되돌리고 한글 사유를 남긴다", () => {
    const { dependencies, updateLeadStatus, setEditedValue, setEditedCellNote } =
      createDependencies();

    const result = handleConsultationCellEdit(
      createInput({ currentDisplayValue: "상담 완료", currentValue: "상담 완료" }),
      dependencies,
    );

    expect(result).toMatchObject({ handled: true, ok: false, code: "INVALID_TRANSITION" });
    expect(setEditedValue).toHaveBeenCalledWith("신규 신청");
    expect(setEditedCellNote).toHaveBeenCalledWith(
      "현재 상태에서 선택한 상태로 변경할 수 없습니다.",
    );
    expect(updateLeadStatus).not.toHaveBeenCalled();
  });

  it("원본 상태 반영 실패는 상담 목록 변경을 보존하고 재동기화 메모를 남긴다", () => {
    const { dependencies, setEditedValue, setEditedCellNote } = createDependencies({
      updateLeadStatus: () => {
        throw new Error("sheet_write_failed");
      },
    });

    const result = handleConsultationCellEdit(createInput(), dependencies);

    expect(result).toEqual({ handled: true, ok: false, code: "LEAD_SYNC_FAILED" });
    expect(setEditedValue).not.toHaveBeenCalled();
    expect(setEditedCellNote).toHaveBeenCalledWith(
      "원본 반영 대기: 원본 저장 중 오류가 발생했습니다. 소유자에게 알려 주세요.",
    );
  });

  it("원본 상태가 이전 화면과 다르면 덮어쓰지 않는다", () => {
    const { dependencies, updateLeadStatus, setEditedCellNote } = createDependencies({
      findLeadById: () => ({ rowNumber: 2, statusCode: "CLOSED", handledAt: "" }),
    });

    const result = handleConsultationCellEdit(createInput(), dependencies);

    expect(result).toEqual({ handled: true, ok: false, code: "LEAD_STATUS_MISMATCH" });
    expect(updateLeadStatus).not.toHaveBeenCalled();
    expect(setEditedCellNote).toHaveBeenCalledWith(
      "원본 반영 대기: 원본 상담 상태가 현재 화면과 다릅니다.",
    );
  });

  it("담당자 이름은 정규화하고 잘못된 값은 이전 값으로 되돌린다", () => {
    const { dependencies, setEditedValue, setEditedCellNote } = createDependencies();

    expect(
      handleConsultationCellEdit(
        createInput({
          columnNumber: CONSULTATION_COLUMN_NUMBERS.assignee,
          previousDisplayValue: "",
          currentDisplayValue: "  이관수  ",
          currentValue: "  이관수  ",
        }),
        dependencies,
      ),
    ).toEqual({ handled: true, ok: true });
    expect(setEditedValue).toHaveBeenCalledWith("이관수");
    expect(setEditedCellNote).toHaveBeenCalledWith(null);

    expect(
      handleConsultationCellEdit(
        createInput({
          columnNumber: CONSULTATION_COLUMN_NUMBERS.assignee,
          previousDisplayValue: "이관수",
          currentDisplayValue: "=IMPORTXML()",
          currentValue: "=IMPORTXML()",
        }),
        dependencies,
      ),
    ).toMatchObject({ handled: true, ok: false, code: "INVALID_ASSIGNEE" });
    expect(setEditedValue).toHaveBeenLastCalledWith("이관수");
  });

  it("다음 연락 예정일과 상담 결과의 허용값을 검증한다", () => {
    const { dependencies, setEditedValue } = createDependencies();
    const invalidDate = handleConsultationCellEdit(
      createInput({
        columnNumber: CONSULTATION_COLUMN_NUMBERS.nextContactAt,
        previousDisplayValue: "",
        currentDisplayValue: "내일",
        currentValue: "내일",
      }),
      dependencies,
    );
    const invalidResult = handleConsultationCellEdit(
      createInput({
        columnNumber: CONSULTATION_COLUMN_NUMBERS.result,
        previousDisplayValue: "미입력",
        currentDisplayValue: "자유 입력",
        currentValue: "자유 입력",
      }),
      dependencies,
    );

    expect(invalidDate).toMatchObject({ ok: false, code: "INVALID_NEXT_CONTACT_AT" });
    expect(invalidResult).toMatchObject({ ok: false, code: "INVALID_RESULT" });
    expect(setEditedValue).toHaveBeenNthCalledWith(1, "");
    expect(setEditedValue).toHaveBeenNthCalledWith(2, "미입력");
  });

  it("운영 대상이 아닌 컬럼 편집은 처리하지 않는다", () => {
    const { dependencies } = createDependencies();

    expect(handleConsultationCellEdit(createInput({ columnNumber: 4 }), dependencies)).toEqual({
      handled: false,
      ok: true,
    });
  });
});
