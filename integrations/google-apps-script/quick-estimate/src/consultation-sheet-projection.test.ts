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
  it("기본 담당자는 새 상담에만 반영하고 기존 담당자를 덮어쓰지 않는다", () => {
    const { sheet, setValues } = createSheet(["lead-a"]);
    syncConsultationSheetRows(
      sheet,
      [createLeadRow("lead-a"), createLeadRow("lead-b")],
      false,
      " 새 담당자 ",
    );
    expect(setValues).toHaveBeenCalledOnce();
    expect(setValues.mock.calls[0]?.[0]).toHaveLength(1);
    expect(setValues.mock.calls[0]?.[0][0]?.[1]).toBe("새 담당자");
    expect(setValues.mock.calls[0]?.[0][0]?.[15]).toBe("lead-b");
  });

  it("설정이 없으면 미배정이며 잘못된 이름은 쓰기 전에 거절한다", () => {
    const { sheet, setValues } = createSheet();
    syncConsultationSheetRows(sheet, [createLeadRow("lead-a")]);
    expect(setValues.mock.calls[0]?.[0][0]?.[1]).toBe("");
    setValues.mockClear();
    expect(() =>
      syncConsultationSheetRows(sheet, [createLeadRow("lead-b")], false, "=1+1"),
    ).toThrow("default_assignee_invalid");
    expect(setValues).not.toHaveBeenCalled();
  });
  it("확장 상담의 출처 표시만 보강하고 기존 업무값과 새 행 수를 유지한다", () => {
    const business = ["연락 중", "기존 담당자", ...Array<string>(13).fill("업무값"), "lead-a"];
    const cells = [...business, "", ""];
    const writes = vi.fn((values: (string | number)[][]) => {
      cells.splice(16, 2, ...values[0]!.map(String));
    });
    const sheet: ConsultationSheetPort = {
      getLastRow: () => 2,
      getRange: (_row, column, _rows, width) => ({
        getDisplayValues: () => [cells.slice(column - 1, column - 1 + width)],
        setValues: writes,
      }),
    };
    const row = [
      ...createLeadRow("lead-a"),
      2,
      "embed",
      "partner.example",
      "https://partner.example",
      "parent_message",
    ];
    expect(syncConsultationSheetRows(sheet, [row], true).createdRows).toBe(0);
    syncConsultationSheetRows(sheet, [row], true);
    expect(cells.slice(0, 16)).toEqual(business);
    expect(cells.slice(16)).toEqual(["partner.example", "부모 페이지 전달"]);
    expect(writes).toHaveBeenCalledOnce();
  });
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
