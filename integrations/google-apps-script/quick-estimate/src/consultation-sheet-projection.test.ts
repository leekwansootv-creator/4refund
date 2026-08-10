import { describe, expect, it, vi } from "vitest";

import type { LeadSheetCell, LeadSheetRow } from "./sheet-schema";
import {
  syncConsultationSheetRows,
  type ConsultationSheetPort,
} from "./consultation-sheet-projection";

function createLeadRow(leadId: string): LeadSheetRow {
  return [
    leadId,
    `request-${leadId}`,
    "2026-08-10T01:18:00.000Z",
    "software_it",
    100,
    10_870_000,
    200,
    "rule-v1",
    "benchmark-v1",
    "테스트 주식회사",
    "홍길동",
    "test@example.com",
    "01000000000",
    "CONSENT",
    "privacy-v1",
    true,
    "2026-08-10T01:18:00.000Z",
    false,
    "",
    "marketing-v1",
    "",
    "/",
    "NEW",
    "",
  ];
}

function createSheet(existingLeadIds: string[] = []) {
  const setValues = vi.fn<(values: LeadSheetCell[][]) => unknown>();
  const getRange = vi.fn((row: number, column: number, numberOfRows: number) => ({
    getDisplayValues: () =>
      column === 16 ? existingLeadIds.slice(0, numberOfRows).map((leadId) => [leadId]) : [],
    setValues,
  }));
  const sheet: ConsultationSheetPort = {
    getLastRow: () => Math.max(existingLeadIds.length + 1, 1),
    getRange,
  };

  return { sheet, getRange, setValues };
}

describe("syncConsultationSheetRows", () => {
  it("상담 목록에 없는 lead_id만 한글 행으로 한 번에 추가한다", () => {
    const { sheet, getRange, setValues } = createSheet(["lead-a"]);

    const result = syncConsultationSheetRows(sheet, [
      createLeadRow("lead-a"),
      createLeadRow("lead-b"),
      createLeadRow("lead-c"),
    ]);

    expect(result).toEqual({ createdRows: 2, existingRows: 1, skippedRows: 0 });
    expect(getRange).toHaveBeenCalledWith(2, 16, 1, 1);
    expect(getRange).toHaveBeenCalledWith(3, 1, 2, 16);
    expect(setValues).toHaveBeenCalledOnce();
    expect(setValues.mock.calls[0]?.[0].map((row) => row[15])).toEqual(["lead-b", "lead-c"]);
  });

  it("같은 입력과 기존 상담 행을 다시 동기화해도 중복 행을 만들지 않는다", () => {
    const { sheet, setValues } = createSheet(["lead-a", "lead-b"]);

    const result = syncConsultationSheetRows(sheet, [
      createLeadRow("lead-a"),
      createLeadRow("lead-b"),
      createLeadRow("lead-b"),
    ]);

    expect(result).toEqual({ createdRows: 0, existingRows: 3, skippedRows: 0 });
    expect(setValues).not.toHaveBeenCalled();
  });

  it("식별자가 없는 손상 원본은 상담 목록에 만들지 않는다", () => {
    const { sheet, setValues } = createSheet();

    const result = syncConsultationSheetRows(sheet, [createLeadRow("")]);

    expect(result).toEqual({ createdRows: 0, existingRows: 0, skippedRows: 1 });
    expect(setValues).not.toHaveBeenCalled();
  });
});
