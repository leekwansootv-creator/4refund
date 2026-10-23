import {
  buildConsultationSheetRow,
  CONSULTATION_SHEET_HEADERS,
  buildConsultationSourceCells,
  type ConsultationSheetCell,
} from "./consultation-sheet-schema";
import type { LeadSheetRow } from "./sheet-schema";

const CONSULTATION_LEAD_ID_COLUMN_NUMBER = 16;

type ConsultationSheetRangePort = {
  getDisplayValues: () => string[][];
  setValues: (values: ConsultationSheetCell[][]) => unknown;
};

/** 상담 목록 투영 로직이 사용하는 최소 Sheet port입니다. */
export type ConsultationSheetPort = {
  getMaxColumns?: () => number;
  getLastColumn?: () => number;
  getLastRow: () => number;
  getRange: (
    row: number,
    column: number,
    numberOfRows: number,
    numberOfColumns: number,
  ) => ConsultationSheetRangePort;
};

/** 상담 목록 재동기화에서 생성·유지·제외한 원본 행 수입니다. */
export type ConsultationSheetSyncResult = {
  createdRows: number;
  existingRows: number;
  skippedRows: number;
};

function getLeadId(row: LeadSheetRow): string {
  return String(row[0] ?? "").trim();
}

function getExistingLeadIds(sheet: ConsultationSheetPort): Set<string> {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return new Set();
  }

  return new Set(
    sheet
      .getRange(2, CONSULTATION_LEAD_ID_COLUMN_NUMBER, lastRow - 1, 1)
      .getDisplayValues()
      .flat()
      .filter(Boolean),
  );
}

/** 원본 행들을 lead_id 기준으로 비교해 상담 목록에 없는 행만 한 번에 추가합니다. */
export function syncConsultationSheetRows(
  sheet: ConsultationSheetPort,
  leadRows: readonly LeadSheetRow[],
  attributed = false,
): ConsultationSheetSyncResult {
  const existingLeadIds = getExistingLeadIds(sheet);
  const sourceRows = new Map<string, { number: number; cells: string[] }>();
  if (attributed && sheet.getLastRow() > 1) {
    sheet
      .getRange(2, 16, sheet.getLastRow() - 1, 3)
      .getDisplayValues()
      .forEach((row, index) => {
        const id = row[0];
        if (!id) return;
        if (sourceRows.has(id)) throw new Error("consultation_duplicate_id");
        sourceRows.set(id, { number: index + 2, cells: row.slice(1, 3) });
      });
  }
  const rowsToCreate: ConsultationSheetCell[][] = [];
  let existingRows = 0;
  let skippedRows = 0;

  for (const leadRow of leadRows) {
    const leadId = getLeadId(leadRow);

    if (leadId === "") {
      skippedRows += 1;
      continue;
    }

    if (existingLeadIds.has(leadId)) {
      if (attributed) {
        const sourceRow = sourceRows.get(leadId);
        const cells = buildConsultationSourceCells(leadRow);
        if (sourceRow && sourceRow.cells.join("|") !== cells.join("|")) {
          sheet.getRange(sourceRow.number, 17, 1, 2).setValues([cells]);
          sourceRow.cells = cells;
        }
      }
      existingRows += 1;
      continue;
    }

    rowsToCreate.push([
      ...buildConsultationSheetRow(leadRow),
      ...(attributed ? buildConsultationSourceCells(leadRow) : []),
    ]);
    existingLeadIds.add(leadId);
  }

  if (rowsToCreate.length > 0) {
    const nextRow = Math.max(sheet.getLastRow() + 1, 2);

    sheet
      .getRange(
        nextRow,
        1,
        rowsToCreate.length,
        CONSULTATION_SHEET_HEADERS.length + (attributed ? 2 : 0),
      )
      .setValues(rowsToCreate);
  }

  return {
    createdRows: rowsToCreate.length,
    existingRows,
    skippedRows,
  };
}
