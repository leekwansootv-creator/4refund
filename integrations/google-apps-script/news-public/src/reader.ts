import {
  NEWS_HEADERS,
  SNAPSHOT_HEADERS,
  recordFromRow,
  snapshotFromRow,
} from "../../news-insights/src/model";

function rows(name: string, headers: readonly string[], lastColumn: string, limit: number) {
  const id = PropertiesService.getScriptProperties().getProperty("NEWS_SPREADSHEET_ID");
  if (!id || !/^[a-zA-Z0-9_-]{20,100}$/u.test(id) || typeof Sheets === "undefined")
    throw new Error("NEWS_SETTINGS_INVALID");
  // SpreadsheetApp.openById는 쓰기 scope를 요구하므로 readonly를 지원하는 고급 Sheets API만 쓴다.
  const response = Sheets.Spreadsheets.get(id, {
    ranges: [`'${name}'!A1:${lastColumn}${limit + 2}`],
    fields: "sheets(data(rowData(values(formattedValue,userEnteredValue(formulaValue)))))",
  });
  if (response.sheets?.length !== 1 || response.sheets[0]?.data?.length !== 1)
    throw new Error("NEWS_RANGE_INVALID");
  const data = (response.sheets[0].data[0]?.rowData ?? []).map((row) => {
    const cells = row.values ?? [];
    if (cells.some((cell) => cell.userEnteredValue?.formulaValue !== undefined))
      throw new Error("NEWS_FORMULA_REJECTED");
    if (cells.slice(headers.length).some((cell) => cell.formattedValue))
      throw new Error("NEWS_COLUMNS_INVALID");
    return headers.map((_, index) => cells[index]?.formattedValue ?? "");
  });
  while (data.length > 1 && data.at(-1)?.every((value) => !value)) data.pop();
  if (data.length > limit + 1 || data[0]?.join("\t") !== headers.join("\t"))
    throw new Error("NEWS_ROWS_INVALID");
  return data.slice(1);
}

function unique<T extends { id: string }>(values: T[]): T[] {
  if (new Set(values.map((value) => value.id)).size !== values.length)
    throw new Error("NEWS_DUPLICATE_ID");
  return values;
}

/** 읽기 전용 Sheets API로 고정된 뉴스 관리 범위만 읽고 모델 계약을 검사한다. */
export function readNewsRecords() {
  return unique(rows("뉴스 관리", NEWS_HEADERS, "R", 100).map(recordFromRow));
}

/** 공개 참조 검증에 필요한 불변 게시본만 지정된 뉴스 탭에서 읽는다. */
export function readNewsSnapshots() {
  return unique(rows("뉴스 게시본", SNAPSHOT_HEADERS, "I", 300).map(snapshotFromRow));
}
