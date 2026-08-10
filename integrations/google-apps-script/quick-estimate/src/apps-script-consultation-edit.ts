import {
  handleConsultationCellEdit,
  type ConsultationLeadStatusRecord,
} from "./consultation-edit-service";
import {
  CONSULTATION_COLUMN_NUMBERS,
  CONSULTATION_RESULT_OPTIONS,
  CONSULTATION_STATUS_OPTIONS,
} from "./consultation-sheet-schema";
import {
  CONSULTATION_SHEET_NAME,
  LEADS_SHEET_NAME,
  LOCK_TIMEOUT_MILLISECONDS,
  SPREADSHEET_ID_PROPERTY,
} from "./apps-script-config";

const EDIT_HANDLER_FUNCTION_NAME = "onEditQuickEstimateConsultation";
const LEAD_STATUS_COLUMN_NUMBER = 23;
const LEAD_STATUS_COLUMN_COUNT = 2;
const KOREAN_SPREADSHEET_LOCALE = "ko_KR";
const KOREAN_TIME_ZONE = "Asia/Seoul";
const NEXT_CONTACT_AT_NUMBER_FORMAT = "yyyy. mm. dd. am/pm h:mm";

type ConsultationEditTriggerDependencies = {
  getConfiguredSpreadsheetId: () => string | null;
  getScriptLock: () => {
    tryLock: (timeoutInMilliseconds: number) => boolean;
    releaseLock: () => void;
  };
  logFailure: (event: { code: string; leadId?: string; occurredAt: string }) => void;
  now: () => Date;
};

function createStatusValidation(): GoogleAppsScript.Spreadsheet.DataValidation {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(Array.from(CONSULTATION_STATUS_OPTIONS), true)
    .setAllowInvalid(false)
    .setHelpText("상담 상태는 목록에서 선택해 주세요.")
    .build();
}

function createAssigneeValidation(): GoogleAppsScript.Spreadsheet.DataValidation {
  return SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied(
      '=OR(B2="",AND(LEN(TRIM(B2))<=30,REGEXMATCH(TRIM(B2),"^[가-힣A-Za-z][가-힣A-Za-z\\s·-]{0,29}$")))',
    )
    .setAllowInvalid(false)
    .setHelpText("상담 담당자는 30자 이내의 이름으로 입력해 주세요.")
    .build();
}

function createNextContactAtValidation(): GoogleAppsScript.Spreadsheet.DataValidation {
  return SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText("다음 연락 예정일은 날짜와 시각으로 입력해 주세요.")
    .build();
}

function createResultValidation(): GoogleAppsScript.Spreadsheet.DataValidation {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(Array.from(CONSULTATION_RESULT_OPTIONS), true)
    .setAllowInvalid(false)
    .setHelpText("상담 결과는 목록에서 선택해 주세요.")
    .build();
}

function createStatusConditionalFormatRules(
  range: GoogleAppsScript.Spreadsheet.Range,
): GoogleAppsScript.Spreadsheet.ConditionalFormatRule[] {
  return [
    { label: "신규 신청", background: "#FFF3CD", font: "#664D03" },
    { label: "연락 중", background: "#DDEBFF", font: "#174EA6" },
    { label: "상담 완료", background: "#DDF4E4", font: "#146C43" },
    { label: "종결", background: "#E5E7EB", font: "#374151" },
  ].map(({ label, background, font }) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(label)
      .setBackground(background)
      .setFontColor(font)
      .setRanges([range])
      .build(),
  );
}

/** 상담 목록의 한글 선택값, 날짜 형식과 상태별 색상 규칙을 설정합니다. */
export function configureConsultationSheetAutomation(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
): void {
  const dataRowCount = sheet.getMaxRows() - 1;

  sheet.getParent().setSpreadsheetLocale(KOREAN_SPREADSHEET_LOCALE);
  sheet.getParent().setSpreadsheetTimeZone(KOREAN_TIME_ZONE);

  if (dataRowCount <= 0) {
    return;
  }

  const statusRange = sheet.getRange(2, CONSULTATION_COLUMN_NUMBERS.status, dataRowCount, 1);

  statusRange.setDataValidation(createStatusValidation());
  sheet
    .getRange(2, CONSULTATION_COLUMN_NUMBERS.assignee, dataRowCount, 1)
    .setDataValidation(createAssigneeValidation());
  sheet
    .getRange(2, CONSULTATION_COLUMN_NUMBERS.nextContactAt, dataRowCount, 1)
    .setDataValidation(createNextContactAtValidation())
    .setNumberFormat(NEXT_CONTACT_AT_NUMBER_FORMAT);
  sheet
    .getRange(2, CONSULTATION_COLUMN_NUMBERS.result, dataRowCount, 1)
    .setDataValidation(createResultValidation());
  sheet.setConditionalFormatRules(createStatusConditionalFormatRules(statusRange));
}

/** 승인 계정이 소유한 상담 목록 installable edit trigger를 중복 없이 생성합니다. */
export function ensureConsultationEditTrigger(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
): boolean {
  const triggerExists = ScriptApp.getUserTriggers(spreadsheet).some(
    (trigger) =>
      trigger.getHandlerFunction() === EDIT_HANDLER_FUNCTION_NAME &&
      trigger.getEventType() === ScriptApp.EventType.ON_EDIT,
  );

  if (triggerExists) {
    return false;
  }

  ScriptApp.newTrigger(EDIT_HANDLER_FUNCTION_NAME).forSpreadsheet(spreadsheet).onEdit().create();

  return true;
}

function findLeadStatusRecord(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
  leadId: string,
): ConsultationLeadStatusRecord | null {
  const leadsSheet = spreadsheet.getSheetByName(LEADS_SHEET_NAME);

  if (leadsSheet === null || leadsSheet.getLastRow() <= 1) {
    return null;
  }

  const leadIds = leadsSheet.getRange(2, 1, leadsSheet.getLastRow() - 1, 1).getDisplayValues();
  const index = leadIds.findIndex((row) => row[0] === leadId);

  if (index < 0) {
    return null;
  }

  const rowNumber = index + 2;
  const values = leadsSheet
    .getRange(rowNumber, LEAD_STATUS_COLUMN_NUMBER, 1, LEAD_STATUS_COLUMN_COUNT)
    .getDisplayValues()[0];

  return {
    rowNumber,
    statusCode: values?.[0] ?? "",
    handledAt: values?.[1] ?? "",
  };
}

function logFailureSafely(
  dependencies: ConsultationEditTriggerDependencies,
  event: Parameters<ConsultationEditTriggerDependencies["logFailure"]>[0],
): void {
  try {
    dependencies.logFailure(event);
  } catch {
    // logger 장애가 상담 목록과 원본 상태를 추가로 변경하지 않게 격리합니다.
  }
}

/** installable onEdit event를 검증하고 상담 상태를 숨겨진 lead_id 기준 원본에 반영합니다. */
export function handleAppsScriptConsultationEdit(
  event: GoogleAppsScript.Events.SheetsOnEdit | undefined,
  dependencies: ConsultationEditTriggerDependencies,
): void {
  if (event === undefined) {
    return;
  }

  const range = event.range;
  const sheet = range.getSheet();
  const configuredSpreadsheetId = dependencies.getConfiguredSpreadsheetId();

  if (
    configuredSpreadsheetId === null ||
    event.source.getId() !== configuredSpreadsheetId ||
    sheet.getName() !== CONSULTATION_SHEET_NAME ||
    range.getRow() <= 1
  ) {
    return;
  }

  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) {
    range.setNote("상담 업무값은 한 번에 한 셀씩 수정해 주세요.");
    return;
  }

  const lock = dependencies.getScriptLock();

  if (!lock.tryLock(LOCK_TIMEOUT_MILLISECONDS)) {
    range.setNote("다른 작업이 진행 중입니다. 잠시 후 다시 수정해 주세요.");
    return;
  }

  try {
    const rowNumber = range.getRow();
    const rowValues = sheet
      .getRange(rowNumber, 1, 1, CONSULTATION_COLUMN_NUMBERS.leadId)
      .getDisplayValues()[0] ?? [""];
    const leadId = String(rowValues[CONSULTATION_COLUMN_NUMBERS.leadId - 1] ?? "").trim();
    const ownerEmail = event.source.getOwner()?.getEmail().toLowerCase() ?? "";
    const editorEmail = event.user?.getEmail().toLowerCase() ?? "";
    const result = handleConsultationCellEdit(
      {
        columnNumber: range.getColumn(),
        previousDisplayValue: event.oldValue ?? "",
        currentDisplayValue: range.getDisplayValue(),
        currentValue: range.getValue(),
        rowValues,
        editorIsOwner: editorEmail !== "" && editorEmail === ownerEmail,
      },
      {
        findLeadById: (targetLeadId) => findLeadStatusRecord(event.source, targetLeadId),
        updateLeadStatus: (targetRowNumber, statusCode, handledAt) => {
          const leadsSheet = event.source.getSheetByName(LEADS_SHEET_NAME);

          if (leadsSheet === null) {
            throw new Error("leads_sheet_not_found");
          }

          leadsSheet
            .getRange(targetRowNumber, LEAD_STATUS_COLUMN_NUMBER, 1, LEAD_STATUS_COLUMN_COUNT)
            .setValues([[statusCode, handledAt]]);
        },
        setFirstContactAt: (displayValue) => {
          sheet
            .getRange(rowNumber, CONSULTATION_COLUMN_NUMBERS.firstContactAt, 1, 1)
            .setValue(displayValue);
        },
        setEditedValue: (value) => range.setValue(value),
        setEditedCellNote: (note) => range.setNote(note),
        now: dependencies.now,
      },
    );

    if (!result.ok && result.code.startsWith("LEAD_")) {
      logFailureSafely(dependencies, {
        code: result.code,
        occurredAt: dependencies.now().toISOString(),
        ...(leadId === "" ? {} : { leadId }),
      });
    }
  } catch {
    range.setNote("상담 상태 처리 중 오류가 발생했습니다. 소유자에게 알려 주세요.");
    logFailureSafely(dependencies, {
      code: "CONSULTATION_EDIT_TRIGGER_FAILED",
      occurredAt: dependencies.now().toISOString(),
    });
  } finally {
    lock.releaseLock();
  }
}

/** Apps Script installable edit trigger의 전역 진입점입니다. */
export function onEditQuickEstimateConsultation(
  event: GoogleAppsScript.Events.SheetsOnEdit | undefined,
): void {
  handleAppsScriptConsultationEdit(event, {
    getConfiguredSpreadsheetId: () =>
      PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY),
    getScriptLock: () => LockService.getScriptLock(),
    logFailure: (failure) => console.error(JSON.stringify(failure)),
    now: () => new Date(),
  });
}
