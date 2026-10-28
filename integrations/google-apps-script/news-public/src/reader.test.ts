import { afterEach, expect, it, vi } from "vitest";
import {
  NEWS_HEADERS,
  SNAPSHOT_HEADERS,
  createRecord,
  recordToRow,
} from "../../news-insights/src/model";
import { readNewsRecords, readNewsSnapshots } from "./reader";

afterEach(() => vi.unstubAllGlobals());
function setup(rows: string[][]) {
  const response = {
    sheets: [
      {
        data: [
          {
            rowData: rows.map((row) => ({
              values: row.map((formattedValue) => ({ formattedValue })),
            })),
          },
        ],
      },
    ],
  };
  const get = vi.fn(() => response);
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => ({ getProperty: () => "fixture-news-document-0001" }),
  });
  vi.stubGlobal("Sheets", { Spreadsheets: { get } });
  // Google 기본 서비스가 없고 readonly API만 있는 환경에서도 읽기가 가능해야 한다.
  vi.stubGlobal("SpreadsheetApp", undefined);
  return { get, response };
}

it("읽기 권한만으로 고정 탭·필드만 요청하며 생략된 빈 셀을 복원한다", () => {
  const source = createRecord(
    "00000000-0000-4000-8000-000000000001",
    "https://news.example.org/a",
    "2026-10-28T00:00:00.000Z",
  );
  const cells = recordToRow(source);
  while (cells.at(-1) === "") cells.pop();
  const { get } = setup([[...NEWS_HEADERS], cells]);
  expect(readNewsRecords()).toEqual([source]);
  expect(get).toHaveBeenCalledWith("fixture-news-document-0001", {
    ranges: ["'뉴스 관리'!A1:R102"],
    fields: "sheets(data(rowData(values(formattedValue,userEnteredValue(formulaValue)))))",
  });
});

it("게시본이 없으면 빈 목록을 반환하며 게시본 고정 범위만 읽는다", () => {
  const { get } = setup([[...SNAPSHOT_HEADERS], []]);
  expect(readNewsSnapshots()).toEqual([]);
  expect(get).toHaveBeenCalledWith(
    "fixture-news-document-0001",
    expect.objectContaining({ ranges: ["'뉴스 게시본'!A1:I302"] }),
  );
});

it("수식 셀을 표시 결과가 무해해도 거절한다", () => {
  const { response } = setup([[...NEWS_HEADERS]]);
  Object.assign(response.sheets[0]!.data[0]!.rowData[0]!.values[0]!, {
    userEnteredValue: { formulaValue: "=1" },
  });
  expect(readNewsRecords).toThrow("NEWS_FORMULA_REJECTED");
});

it.each([
  { rows: [["잘못된 헤더"]] },
  { rows: [[...NEWS_HEADERS, "추가 열"]] },
  { rows: [[...NEWS_HEADERS], ...Array.from({ length: 101 }, () => ["overflow"])] },
])("헤더·추가 열·최대 행 경계 위반은 실패한다", ({ rows }) => {
  setup(rows);
  expect(readNewsRecords).toThrow();
});
