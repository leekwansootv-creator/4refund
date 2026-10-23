import { LEAD_SHEET_HEADERS, ATTRIBUTED_LEAD_HEADERS } from "./sheet-schema";
import {
  CONSULTATION_SHEET_HEADERS,
  ATTRIBUTED_CONSULTATION_HEADERS,
} from "./consultation-sheet-schema";

/** readback를 마친 migration만 신규 출처 제출을 허용하는 서버 소유 표식입니다. */
export const ATTRIBUTION_SCHEMA_PROPERTY = "QUICK_ESTIMATE_ATTRIBUTION_SCHEMA";

/** 추가 열을 버리지 않고 정확한 구형 또는 확장형 헤더만 판정합니다. */
export function identifySheetSchema(
  headers: readonly string[],
  kind: "leads" | "consultation",
): "legacy" | "attributed" {
  const legacy = kind === "leads" ? LEAD_SHEET_HEADERS : CONSULTATION_SHEET_HEADERS;
  const expanded = kind === "leads" ? ATTRIBUTED_LEAD_HEADERS : ATTRIBUTED_CONSULTATION_HEADERS;
  const trimmed = [...headers];
  while (trimmed[trimmed.length - 1] === "") trimmed.pop();
  if (
    trimmed.length === expanded.length &&
    expanded.every((value, index) => value === trimmed[index])
  )
    return "attributed";
  if (trimmed.length === legacy.length && legacy.every((value, index) => value === trimmed[index]))
    return "legacy";
  throw new Error(`${kind}_sheet_schema_mismatch`);
}

/** 구형 grid를 넘기지 않으면서 뒤에 삽입된 사용자 header도 검사합니다. */
export function readSheetSchema(
  sheet: {
    getMaxColumns?: () => number;
    getLastColumn?: () => number;
    getRange: (
      row: number,
      column: number,
      rows: number,
      columns: number,
    ) => { getDisplayValues: () => string[][] };
  },
  kind: "leads" | "consultation",
): "legacy" | "attributed" {
  const expectedWidth = kind === "leads" ? 29 : 18;
  const width = Math.min(
    sheet.getMaxColumns?.() ?? expectedWidth,
    Math.max(sheet.getLastColumn?.() ?? expectedWidth, expectedWidth),
  );
  return identifySheetSchema(sheet.getRange(1, 1, 1, width).getDisplayValues()[0] ?? [], kind);
}
