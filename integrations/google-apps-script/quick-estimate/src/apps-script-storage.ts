import { MARKETING_CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from "@/features/quick-estimate";
import {
  LEAD_SHEET_COLUMN_DESCRIPTIONS,
  LEAD_SHEET_HEADERS,
  LEAD_STATUSES,
  type LeadSheetCell,
  type LeadSheetRow,
} from "./sheet-schema";
import {
  syncConsultationSheetRows,
  type ConsultationSheetPort,
  type ConsultationSheetSyncResult,
} from "./consultation-sheet-projection";
import { CONSULTATION_SHEET_HEADERS } from "./consultation-sheet-schema";
import type { LeadSheetStoragePort } from "./storage-service";

const SPREADSHEET_ID_PROPERTY = "QUICK_ESTIMATE_SPREADSHEET_ID";
const LEADS_SHEET_NAME = "leads";
const CODEBOOK_SHEET_NAME = "codebook";
const CONSULTATION_SHEET_NAME = "상담 목록";
const LOCK_TIMEOUT_MILLISECONDS = 5_000;
const PHONE_COLUMN_NUMBER = 13;
const CONSULTATION_PHONE_COLUMN_NUMBER = 6;
const CONSULTATION_EMPLOYEE_COLUMN_NUMBER = 9;
const CONSULTATION_AMOUNT_COLUMN_NUMBER = 10;
const CONSULTATION_LEAD_ID_COLUMN_NUMBER = 16;
const PLAIN_TEXT_NUMBER_FORMAT = "@";
const CONSULTATION_HEADER_BACKGROUND = "#315CB6";
const CONSULTATION_DERIVED_BACKGROUND = "#F3F4F6";
const CONSULTATION_EDITABLE_BACKGROUND = "#FFFFFF";
const CONSULTATION_COLUMN_WIDTHS = [
  110, 110, 190, 180, 120, 130, 220, 180, 90, 140, 190, 190, 130, 140, 160, 160,
] as const;

type ScriptLockPort = {
  tryLock: (timeoutInMilliseconds: number) => boolean;
  releaseLock: () => void;
};

type SheetRangePort = {
  getDisplayValues: () => string[][];
  setNumberFormat: (numberFormat: string) => unknown;
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
  getConsultationSheet: () => ConsultationSheetPort;
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

      sheet.getRange(nextRow, PHONE_COLUMN_NUMBER, 1, 1).setNumberFormat(PLAIN_TEXT_NUMBER_FORMAT);
      sheet.getRange(nextRow, 1, 1, LEAD_SHEET_HEADERS.length).setValues([Array.from(row)]);
    },
    syncConsultationRow: (row: LeadSheetRow) => {
      syncConsultationSheetRows(dependencies.getConsultationSheet(), [row]);
    },
  };
}

function getRuntimeSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const spreadsheetId =
    PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY);

  if (spreadsheetId === null) {
    throw new Error("spreadsheet_id_not_configured");
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function getNamedSheet(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  sheetName: string,
): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (sheet === null) {
    throw new Error(`${sheetName}_sheet_not_found`);
  }

  return sheet;
}

function getRuntimeLeadsSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  return getNamedSheet(getRuntimeSpreadsheet(), LEADS_SHEET_NAME);
}

function getRuntimeConsultationSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  return getNamedSheet(getRuntimeSpreadsheet(), CONSULTATION_SHEET_NAME);
}

/** 현재 Apps Script의 Properties, LockService, SpreadsheetApp에 연결한 저장 port를 생성합니다. */
export function createRuntimeLeadSheetStorage(): LeadSheetStoragePort {
  return createAppsScriptLeadSheetStorage({
    getScriptLock: () => LockService.getScriptLock(),
    getLeadsSheet: getRuntimeLeadsSheet,
    getConsultationSheet: getRuntimeConsultationSheet,
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

function initializeConsultationSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const headerRange = sheet.getRange(1, 1, 1, CONSULTATION_SHEET_HEADERS.length);
  const dataRowCount = sheet.getMaxRows() - 1;

  headerRange
    .setValues([Array.from(CONSULTATION_SHEET_HEADERS)])
    .setBackground(CONSULTATION_HEADER_BACKGROUND)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  headerRange.protect().setDescription("Apps Script 관리 상담 목록 header").setWarningOnly(false);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setRowHeight(1, 36);
  sheet.setTabColor(CONSULTATION_HEADER_BACKGROUND);

  CONSULTATION_COLUMN_WIDTHS.forEach((width, index) => {
    sheet.setColumnWidth(index + 1, width);
  });

  if (dataRowCount > 0) {
    sheet
      .getRange(2, 1, dataRowCount, CONSULTATION_SHEET_HEADERS.length)
      .setVerticalAlignment("middle");
    sheet.getRange(2, 1, dataRowCount, 2).setBackground(CONSULTATION_EDITABLE_BACKGROUND);
    sheet.getRange(2, 12, dataRowCount, 2).setBackground(CONSULTATION_EDITABLE_BACKGROUND);
    sheet
      .getRange(2, 3, dataRowCount, 9)
      .setBackground(CONSULTATION_DERIVED_BACKGROUND)
      .protect()
      .setDescription("Apps Script 관리 원본 투영 컬럼")
      .setWarningOnly(false);
    sheet
      .getRange(2, 14, dataRowCount, 3)
      .setBackground(CONSULTATION_DERIVED_BACKGROUND)
      .protect()
      .setDescription("Apps Script 관리 동의·식별 컬럼")
      .setWarningOnly(false);
    sheet
      .getRange(2, CONSULTATION_PHONE_COLUMN_NUMBER, dataRowCount, 1)
      .setNumberFormat(PLAIN_TEXT_NUMBER_FORMAT);
    sheet
      .getRange(2, CONSULTATION_EMPLOYEE_COLUMN_NUMBER, dataRowCount, 1)
      .setNumberFormat('#,##0"명"');
    sheet
      .getRange(2, CONSULTATION_AMOUNT_COLUMN_NUMBER, dataRowCount, 1)
      .setNumberFormat('#,##0"원"');
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), CONSULTATION_SHEET_HEADERS.length).createFilter();
  sheet.hideColumns(CONSULTATION_LEAD_ID_COLUMN_NUMBER);
}

function ensureConsultationSheet(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet): {
  created: boolean;
  sheet: GoogleAppsScript.Spreadsheet.Sheet;
} {
  let sheet = spreadsheet.getSheetByName(CONSULTATION_SHEET_NAME);
  const created = sheet === null;

  if (sheet === null) {
    sheet = spreadsheet.insertSheet(CONSULTATION_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    initializeConsultationSheet(sheet);
  } else {
    const headers = sheet
      .getRange(1, 1, 1, CONSULTATION_SHEET_HEADERS.length)
      .getDisplayValues()[0];

    if (
      headers === undefined ||
      headers.some((header, index) => header !== CONSULTATION_SHEET_HEADERS[index])
    ) {
      throw new Error("consultation_sheet_schema_mismatch");
    }
  }

  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(1);

  return { created, sheet };
}

function getLeadRows(spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet): LeadSheetRow[] {
  const leadsSheet = getNamedSheet(spreadsheet, LEADS_SHEET_NAME);
  const lastRow = leadsSheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  return leadsSheet
    .getRange(2, 1, lastRow - 1, LEAD_SHEET_HEADERS.length)
    .getDisplayValues()
    .map((row) => row as LeadSheetRow);
}

function syncConsultationRows(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  consultationSheet: GoogleAppsScript.Spreadsheet.Sheet,
): ConsultationSheetSyncResult {
  return syncConsultationSheetRows(consultationSheet, getLeadRows(spreadsheet));
}

function withRuntimeScriptLock<Result>(operation: () => Result): Result {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(LOCK_TIMEOUT_MILLISECONDS)) {
    throw new Error("script_lock_unavailable");
  }

  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
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
  leadsSheet
    .getRange(2, PHONE_COLUMN_NUMBER, leadsSheet.getMaxRows() - 1, 1)
    .setNumberFormat(PLAIN_TEXT_NUMBER_FORMAT);

  const codebookSheet = spreadsheet.insertSheet(CODEBOOK_SHEET_NAME);
  const codebookRows = createCodebookRows();

  codebookSheet
    .getRange(1, 1, codebookRows.length, codebookRows[0]?.length ?? 3)
    .setValues(codebookRows);
  codebookSheet.setFrozenRows(1);
  codebookSheet.autoResizeColumns(1, 3);
  ensureConsultationSheet(spreadsheet);
  SpreadsheetApp.flush();
}

/** 승인 계정 Drive에 운영 Spreadsheet를 한 번 생성하고 Script Property에 ID를 저장합니다. */
export function setupQuickEstimateStorage(): {
  created: boolean;
  consultationSheetCreated: boolean;
  syncedRows: number;
  spreadsheetId: string;
  spreadsheetUrl: string;
} {
  return withRuntimeScriptLock(() => {
    const properties = PropertiesService.getScriptProperties();
    const existingSpreadsheetId = properties.getProperty(SPREADSHEET_ID_PROPERTY);

    if (existingSpreadsheetId !== null) {
      const existingSpreadsheet = SpreadsheetApp.openById(existingSpreadsheetId);
      const consultationSheet = ensureConsultationSheet(existingSpreadsheet);
      const syncResult = syncConsultationRows(existingSpreadsheet, consultationSheet.sheet);

      SpreadsheetApp.flush();

      return {
        created: false,
        consultationSheetCreated: consultationSheet.created,
        syncedRows: syncResult.createdRows,
        spreadsheetId: existingSpreadsheet.getId(),
        spreadsheetUrl: existingSpreadsheet.getUrl(),
      };
    }

    const spreadsheet = SpreadsheetApp.create("간단 견적 리드 저장소");

    initializeSpreadsheet(spreadsheet);
    properties.setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());

    return {
      created: true,
      consultationSheetCreated: true,
      syncedRows: 0,
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
    };
  });
}

/** 기존 leads 원본 중 상담 목록에 없는 행만 lead_id 기준으로 다시 반영합니다. */
export function syncQuickEstimateConsultationRows(): ConsultationSheetSyncResult {
  return withRuntimeScriptLock(() => {
    const spreadsheet = getRuntimeSpreadsheet();
    const consultationSheet = ensureConsultationSheet(spreadsheet);
    const result = syncConsultationRows(spreadsheet, consultationSheet.sheet);

    SpreadsheetApp.flush();

    return result;
  });
}
