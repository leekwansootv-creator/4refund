import { describe, expect, it, vi } from "vitest";

import { LEAD_SHEET_HEADERS, type LeadSheetCell } from "./sheet-schema";
import {
  createAppsScriptLeadSheetStorage,
  type AppsScriptLeadSheetDependencies,
} from "./apps-script-storage";

function createDependencies(overrides: Partial<AppsScriptLeadSheetDependencies> = {}) {
  const releaseLock = vi.fn();
  const setNumberFormat = vi.fn();
  const setValues = vi.fn();
  const getRange = vi.fn(() => ({
    getDisplayValues: () => [],
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
    ...overrides,
  };

  return { dependencies, releaseLock, setNumberFormat, setValues, getRange };
}

describe("createAppsScriptLeadSheetStorage", () => {
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

    expect(getRange).toHaveBeenNthCalledWith(1, 5, 13, 1, 1);
    expect(setNumberFormat).toHaveBeenCalledWith("@");
    expect(getRange).toHaveBeenCalledWith(5, 1, 1, 24);
    expect(setValues).toHaveBeenCalledWith([row]);
  });
});
