import { describe, expect, it, vi } from "vitest";

import { handleAppsScriptConsultationEdit } from "./apps-script-consultation-edit";

const NOW = new Date("2026-08-10T03:04:05.000Z");

function createFixture(
  overrides: {
    configuredSpreadsheetId?: string | null;
    editorEmail?: string;
    newStatus?: string;
    oldStatus?: string;
    ownerEmail?: string;
    rangeColumns?: number;
    rangeRows?: number;
    rawStatus?: string;
    result?: string;
    sheetName?: string;
    spreadsheetId?: string;
  } = {},
) {
  const setEditedValue = vi.fn();
  const setEditedNote = vi.fn();
  const setFirstContactAt = vi.fn();
  const setLeadValues = vi.fn();
  const releaseLock = vi.fn();
  const logFailure = vi.fn();
  const rowValues = Array.from({ length: 16 }, () => "");
  const newStatus = overrides.newStatus ?? "연락 중";

  rowValues[0] = newStatus;
  rowValues[12] = overrides.result ?? "미입력";
  rowValues[15] = "lead-a";

  const leadsSheet = {
    getLastRow: () => 2,
    getRange: vi.fn((row: number, column: number) => ({
      getDisplayValues: () => {
        if (row === 2 && column === 1) {
          return [["lead-a"]];
        }

        return [[overrides.rawStatus ?? "NEW", ""]];
      },
      setValues: setLeadValues,
    })),
  };
  const consultationSheet = {
    getName: () => overrides.sheetName ?? "상담 목록",
    getRange: vi.fn((row: number, column: number) => {
      if (row === 2 && column === 1) {
        return { getDisplayValues: () => [rowValues] };
      }

      return { setValue: setFirstContactAt };
    }),
  };
  const source = {
    getId: () => overrides.spreadsheetId ?? "sheet-a",
    getOwner: () => ({ getEmail: () => overrides.ownerEmail ?? "owner@example.com" }),
    getSheetByName: (name: string) => (name === "leads" ? leadsSheet : null),
  };
  const range = {
    getColumn: () => 1,
    getDisplayValue: () => newStatus,
    getNumColumns: () => overrides.rangeColumns ?? 1,
    getNumRows: () => overrides.rangeRows ?? 1,
    getRow: () => 2,
    getSheet: () => consultationSheet,
    getValue: () => newStatus,
    setNote: setEditedNote,
    setValue: setEditedValue,
  };
  const event = {
    oldValue: overrides.oldStatus ?? "신규 신청",
    range,
    source,
    user: { getEmail: () => overrides.editorEmail ?? "staff@example.com" },
    value: newStatus,
  } as unknown as GoogleAppsScript.Events.SheetsOnEdit;
  const dependencies = {
    getConfiguredSpreadsheetId: () => overrides.configuredSpreadsheetId ?? "sheet-a",
    getScriptLock: () => ({
      tryLock: () => true,
      releaseLock,
    }),
    logFailure,
    now: () => NOW,
  };

  return {
    dependencies,
    event,
    logFailure,
    releaseLock,
    setEditedNote,
    setEditedValue,
    setFirstContactAt,
    setLeadValues,
  };
}

describe("handleAppsScriptConsultationEdit", () => {
  it("한글 상태 편집을 숨겨진 lead_id의 원본 상태와 최초 연락 시각에 반영한다", () => {
    const fixture = createFixture();

    handleAppsScriptConsultationEdit(fixture.event, fixture.dependencies);

    expect(fixture.setLeadValues).toHaveBeenCalledWith([["CONTACTING", NOW.toISOString()]]);
    expect(fixture.setFirstContactAt).toHaveBeenCalledWith("2026. 08. 10. 오후 12:04");
    expect(fixture.setEditedNote).toHaveBeenCalledWith(null);
    expect(fixture.releaseLock).toHaveBeenCalledOnce();
    expect(fixture.logFailure).not.toHaveBeenCalled();
  });

  it("소유자가 아닌 편집자의 완료 상담 재개를 이전 값으로 되돌린다", () => {
    const fixture = createFixture({
      newStatus: "연락 중",
      oldStatus: "상담 완료",
      rawStatus: "COMPLETED",
      result: "다시 연락 요청",
    });

    handleAppsScriptConsultationEdit(fixture.event, fixture.dependencies);

    expect(fixture.setEditedValue).toHaveBeenCalledWith("상담 완료");
    expect(fixture.setEditedNote).toHaveBeenCalledWith(
      "완료하거나 종결한 상담의 재개는 Sheet 소유자만 할 수 있습니다.",
    );
    expect(fixture.setLeadValues).not.toHaveBeenCalled();
  });

  it("다른 Spreadsheet와 다른 Sheet의 편집은 처리하지 않는다", () => {
    const otherSpreadsheet = createFixture({ spreadsheetId: "sheet-b" });
    const otherSheet = createFixture({ sheetName: "leads" });

    handleAppsScriptConsultationEdit(otherSpreadsheet.event, otherSpreadsheet.dependencies);
    handleAppsScriptConsultationEdit(otherSheet.event, otherSheet.dependencies);

    expect(otherSpreadsheet.releaseLock).not.toHaveBeenCalled();
    expect(otherSheet.releaseLock).not.toHaveBeenCalled();
  });

  it("여러 셀을 한 번에 수정하면 원본 동기화 없이 한글 안내를 남긴다", () => {
    const fixture = createFixture({ rangeRows: 2 });

    handleAppsScriptConsultationEdit(fixture.event, fixture.dependencies);

    expect(fixture.setEditedNote).toHaveBeenCalledWith(
      "상담 업무값은 한 번에 한 셀씩 수정해 주세요.",
    );
    expect(fixture.setLeadValues).not.toHaveBeenCalled();
    expect(fixture.releaseLock).not.toHaveBeenCalled();
  });
});
