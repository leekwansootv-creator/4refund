import { describe, expect, it, vi } from "vitest";

import { LEAD_SHEET_HEADERS, type LeadSheetCell } from "./sheet-schema";
import { CONSULTATION_SHEET_HEADERS } from "./consultation-sheet-schema";
import {
  createAppsScriptLeadSheetStorage,
  type AppsScriptLeadSheetDependencies,
} from "./apps-script-storage";

function createDependencies(overrides: Partial<AppsScriptLeadSheetDependencies> = {}) {
  const releaseLock = vi.fn();
  const setNumberFormat = vi.fn();
  const setValues = vi.fn();
  const getRange = vi.fn((row: number) => ({
    getDisplayValues: () => (row === 1 ? [Array.from(LEAD_SHEET_HEADERS)] : []),
    setNumberFormat,
    setValues,
  }));
  const dependencies: AppsScriptLeadSheetDependencies = {
    getScriptLock: () => ({
      tryLock: () => true,
      releaseLock,
    }),
    getLeadsSheet: () => ({
      getLastRow: () => 1,
      getRange,
    }),
    getConsultationSheet: () => ({
      getLastRow: () => 1,
      getRange,
    }),
    ...overrides,
  };

  return { dependencies, releaseLock, setNumberFormat, setValues, getRange };
}

describe("createAppsScriptLeadSheetStorage", () => {
  it("구형 시트의 실제 grid 폭을 넘겨 header를 읽지 않는다", () => {
    const { dependencies } = createDependencies();
    const range = vi.fn((row: number, _column: number, _rows: number, width: number) => {
      if (width > 24) throw new Error("grid_limit");
      return {
        getDisplayValues: () => (row === 1 ? [[...LEAD_SHEET_HEADERS]] : []),
        setValues: vi.fn(),
        setNumberFormat: vi.fn(),
      };
    });
    const storage = createAppsScriptLeadSheetStorage({
      ...dependencies,
      getLeadsSheet: () => ({ getLastRow: () => 1, getMaxColumns: () => 24, getRange: range }),
    });
    expect(() => storage.appendLeadRow([...LEAD_SHEET_HEADERS])).not.toThrow();
    expect(range).toHaveBeenCalledWith(1, 1, 1, 24);
  });
  it("5초 안에 Script lock을 얻지 못하면 operation을 실행하지 않는다", () => {
    const operation = vi.fn();
    const releaseLock = vi.fn();
    const { dependencies } = createDependencies({
      getScriptLock: () => ({
        tryLock: (timeout) => {
          expect(timeout).toBe(5_000);
          return false;
        },
        releaseLock,
      }),
    });
    const storage = createAppsScriptLeadSheetStorage(dependencies);

    expect(() => storage.withLock(operation)).toThrow("script_lock_unavailable");
    expect(operation).not.toHaveBeenCalled();
    expect(releaseLock).not.toHaveBeenCalled();
  });

  it("operation 실패에도 획득한 Script lock을 해제한다", () => {
    const { dependencies, releaseLock } = createDependencies();
    const storage = createAppsScriptLeadSheetStorage(dependencies);

    expect(() =>
      storage.withLock(() => {
        throw new Error("operation_failed");
      }),
    ).toThrow("operation_failed");
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it("header를 제외한 lead_id와 request_id 범위에서 기존 리드를 찾는다", () => {
    const getRange = vi.fn(() => ({
      getDisplayValues: () => [
        ["lead-a", "request-a"],
        ["lead-b", "request-b"],
      ],
      setNumberFormat: vi.fn(),
      setValues: vi.fn(),
    }));
    const { dependencies } = createDependencies({
      getLeadsSheet: () => ({
        getLastRow: () => 3,
        getRange,
      }),
    });
    const storage = createAppsScriptLeadSheetStorage(dependencies);

    expect(storage.findLeadIdByRequestId("request-b")).toBe("lead-b");
    expect(storage.findLeadIdByRequestId("request-missing")).toBeNull();
    expect(getRange).toHaveBeenCalledWith(2, 1, 2, 2);
  });

  it("전화번호 셀을 일반 텍스트로 지정한 뒤 다음 빈 행의 24개 컬럼을 저장한다", () => {
    const { dependencies, getRange, setNumberFormat, setValues } = createDependencies({
      getLeadsSheet: () => ({
        getLastRow: () => 4,
        getRange,
      }),
    });
    const storage = createAppsScriptLeadSheetStorage(dependencies);
    const row = LEAD_SHEET_HEADERS.map((header) => header) satisfies LeadSheetCell[];

    storage.appendLeadRow(row);

    expect(getRange).toHaveBeenCalledWith(5, 13, 1, 1);
    expect(setNumberFormat).toHaveBeenCalledWith("@");
    expect(getRange).toHaveBeenCalledWith(5, 1, 1, 24);
    expect(setValues).toHaveBeenCalledWith([row]);
  });

  it("신규 원본 행을 lead_id 기준 상담 목록 투영에 전달한다", () => {
    const setValues = vi.fn();
    const getRange = vi.fn((row: number) => ({
      getDisplayValues: () => (row === 1 ? [Array.from(CONSULTATION_SHEET_HEADERS)] : []),
      setValues,
    }));
    const { dependencies } = createDependencies({
      getConsultationSheet: () => ({
        getLastRow: () => 1,
        getRange,
      }),
    });
    const storage = createAppsScriptLeadSheetStorage(dependencies);
    const row = LEAD_SHEET_HEADERS.map((header) => header) satisfies LeadSheetCell[];

    storage.syncConsultationRow(row);

    expect(getRange).toHaveBeenCalledWith(2, 1, 1, 16);
    expect(setValues).toHaveBeenCalledOnce();
    expect(setValues.mock.calls[0]?.[0][0]?.[15]).toBe("lead_id");
  });
});
