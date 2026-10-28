import { afterEach, expect, it, vi } from "vitest";
import { authorizeNewsEditor, googleNewsPort } from "./google";
import { createRecord, NEWS_HEADERS } from "./model";

afterEach(() => vi.unstubAllGlobals());
function config(active: string, effective = active, bound = "doc") {
  vi.stubGlobal("Session", {
    getActiveUser: () => ({ getEmail: () => active }),
    getEffectiveUser: () => ({ getEmail: () => effective }),
  });
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => ({
      getProperty: (key: string) =>
        ({ NEWS_EDITOR_EMAILS: "editor@example.org", NEWS_SPREADSHEET_ID: "doc" })[key],
    }),
  });
  vi.stubGlobal("SpreadsheetApp", { getActiveSpreadsheet: () => ({ getId: () => bound }) });
}
it("명시 허용 계정·사용자 실행·현재 문서를 모두 확인한다", () => {
  config("editor@example.org");
  expect(authorizeNewsEditor).not.toThrow();
  config("");
  expect(authorizeNewsEditor).toThrow();
  config("stranger@example.org");
  expect(authorizeNewsEditor).toThrow();
  config("editor@example.org", "owner@example.org");
  expect(authorizeNewsEditor).toThrow();
  config("editor@example.org", "editor@example.org", "other");
  expect(authorizeNewsEditor).toThrow();
});
it("뉴스 두 탭 중 고정 관리 탭만 기록하고 외부 제목은 수식으로 전달하지 않는다", () => {
  const setValues = vi.fn(),
    setNumberFormat = vi.fn();
  const sheet = {
    getLastColumn: () => NEWS_HEADERS.length,
    getLastRow: () => 1,
    getRange: (row: number) =>
      row === 1 ? { getDisplayValues: () => [[...NEWS_HEADERS]] } : { setNumberFormat, setValues },
  };
  const getSheetByName = vi.fn((name: string) => {
    expect(name).toBe("뉴스 관리");
    return sheet;
  });
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => ({ getProperty: () => "configuration-placeholder-id" }),
  });
  vi.stubGlobal("SpreadsheetApp", { openById: () => ({ getSheetByName }), flush: vi.fn() });
  const record = {
    ...createRecord(
      "00000000-0000-4000-8000-000000000001",
      "https://news.example.org/",
      "2026-10-27T00:00:00.000Z",
    ),
    title: "=IMPORTXML(무시)",
  };
  googleNewsPort().write(record, true);
  expect(getSheetByName.mock.calls.every(([name]) => name === "뉴스 관리")).toBe(true);
  expect(setValues.mock.calls[0]?.[0][0][2]).toBe("'=IMPORTXML(무시)");
});
