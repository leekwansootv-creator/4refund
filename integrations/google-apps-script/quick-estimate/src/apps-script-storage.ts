import { MARKETING_CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from "@/features/quick-estimate";
import {
  LEAD_SHEET_COLUMN_DESCRIPTIONS,
  LEAD_SHEET_HEADERS,
  LEAD_STATUSES,
  type LeadSheetCell,
  type LeadSheetRow,
} from "./sheet-schema";
import type { LeadSheetStoragePort } from "./storage-service";

const SPREADSHEET_ID_PROPERTY = "QUICK_ESTIMATE_SPREADSHEET_ID";
const LEADS_SHEET_NAME = "leads";
const CODEBOOK_SHEET_NAME = "codebook";
const LOCK_TIMEOUT_MILLISECONDS = 5_000;

type ScriptLockPort = {
  tryLock: (timeoutInMilliseconds: number) => boolean;
  releaseLock: () => void;
};

type SheetRangePort = {
  getDisplayValues: () => string[][];
  setValues: (values: LeadSheetCell[][]) => unknown;
};

type LeadsSheetPort = {
  getLastRow: () => number;
  getRange: (
    row: number,
    column: number,
    numberOfRows: number,
    numberOfColumns: number,
  ) => SheetRangePort;
};

/** Apps Script service를 얇은 port로 주입하는 Sheet 저장 어댑터 의존성입니다. */
export type AppsScriptLeadSheetDependencies = {
  getScriptLock: () => ScriptLockPort;
  getLeadsSheet: () => LeadsSheetPort;
};

/** Google service를 직접 호출하지 않는 테스트 가능한 leads Sheet 저장 어댑터를 생성합니다. */
export function createAppsScriptLeadSheetStorage(
  dependencies: AppsScriptLeadSheetDependencies,
): LeadSheetStoragePort {
  return {
    withLock: <Result>(operation: () => Result): Result => {
      const lock = dependencies.getScriptLock();

      if (!lock.tryLock(LOCK_TIMEOUT_MILLISECONDS)) {
        throw new Error("script_lock_unavailable");
      }

      try {
        return operation();
      } finally {
        lock.releaseLock();
      }
    },
    findLeadIdByRequestId: (requestId) => {
      const sheet = dependencies.getLeadsSheet();
      const lastRow = sheet.getLastRow();

      if (lastRow <= 1) {
        return null;
      }

      const rows = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
      const matchedRow = rows.find((row) => row[1] === requestId);

      return matchedRow?.[0] || null;
    },
    appendLeadRow: (row: LeadSheetRow) => {
      const sheet = dependencies.getLeadsSheet();
      const nextRow = Math.max(sheet.getLastRow() + 1, 2);

      sheet.getRange(nextRow, 1, 1, LEAD_SHEET_HEADERS.length).setValues([Array.from(row)]);
    },
  };
}

function getRuntimeLeadsSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheetId =
    PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);

  if (spreadsheetId === null) {
    throw new Error("spreadsheet_id_not_configured");
  }

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(LEADS_SHEET_NAME);

  if (sheet === null) {
    throw new Error("leads_sheet_not_found");
  }

  return sheet;
}

/** 현재 Apps Script의 Properties, LockService, SpreadsheetApp에 연결한 저장 port를 생성합니다. */
export function createRuntimeLeadSheetStorage(): LeadSheetStoragePort {
  return createAppsScriptLeadSheetStorage({
    getScriptLock: () => LockService.getScriptLock(),
    getLeadsSheet: getRuntimeLeadsSheet,
  });
}

function createCodebookRows(): LeadSheetCell[][] {
  const columnRows = LEAD_SHEET_HEADERS.map((header, index) => [
    "column",
    header,
    LEAD_SHEET_COLUMN_DESCRIPTIONS[index] ?? "",
  ]);
  const statusRows = LEAD_STATUSES.map((status) => ["lead_status", status, "허용 운영 상태"]);

  return [
    ["category", "code", "description"],
    ...columnRows,
    ...statusRows,
    ["privacy_notice_version", PRIVACY_NOTICE_VERSION, "현재 개인정보 수집·이용 고지 버전"],
    ["marketing_consent_version", MARKETING_CONSENT_VERSION, "현재 선택 마케팅 활용 동의 버전"],
    ["retention", "P1Y", "접수일로부터 1년 보유 후 월 1회 파기 대상 확인"],
  ];
}

function initializeSpreadsheet(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
  const leadsSheet = spreadsheet.getSheets()[0];

  if (leadsSheet === undefined) {
    throw new Error("default_sheet_not_found");
  }

  leadsSheet.setName(LEADS_SHEET_NAME);
  leadsSheet
    .getRange(1, 1, 1, LEAD_SHEET_HEADERS.length)
    .setValues([Array.from(LEAD_SHEET_HEADERS)]);
  leadsSheet.setFrozenRows(1);
  leadsSheet
    .getRange(1, 1, 1, LEAD_SHEET_HEADERS.length)
    .protect()
    .setDescription("Apps Script 관리 header")
    .setWarningOnly(false);

  const statusValidation = SpreadsheetApp.newDataValidation()
    .requireValueInList(Array.from(LEAD_STATUSES), true)
    .setAllowInvalid(false)
    .build();
  leadsSheet.getRange(2, 23, leadsSheet.getMaxRows() - 1, 1).setDataValidation(statusValidation);

  const codebookSheet = spreadsheet.insertSheet(CODEBOOK_SHEET_NAME);
  const codebookRows = createCodebookRows();

  codebookSheet
    .getRange(1, 1, codebookRows.length, codebookRows[0]?.length ?? 3)
    .setValues(codebookRows);
  codebookSheet.setFrozenRows(1);
  codebookSheet.autoResizeColumns(1, 3);
  SpreadsheetApp.flush();
}

/** 승인 계정 Drive에 운영 Spreadsheet를 한 번 생성하고 Script Property에 ID를 저장합니다. */
export function setupQuickEstimateStorage(): {
  created: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
} {
  const properties = PropertiesService.getScriptProperties();
  const existingSpreadsheetId = properties.getProperty(SPREADSHEET_ID_PROPERTY);

  if (existingSpreadsheetId !== null) {
    const existingSpreadsheet = SpreadsheetApp.openById(existingSpreadsheetId);

    return {
      created: false,
      spreadsheetId: existingSpreadsheet.getId(),
      spreadsheetUrl: existingSpreadsheet.getUrl(),
    };
  }

  const spreadsheet = SpreadsheetApp.create("간단 견적 리드 저장소");

  initializeSpreadsheet(spreadsheet);
  properties.setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());

  return {
    created: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
  };
}
