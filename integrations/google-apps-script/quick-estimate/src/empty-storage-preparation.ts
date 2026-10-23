import { MARKETING_CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from "@/features/quick-estimate";
import { configureConsultationSheetAutomation } from "./apps-script-consultation-edit";
import { SPREADSHEET_ID_PROPERTY, LOCK_TIMEOUT_MILLISECONDS } from "./apps-script-config";
import { ATTRIBUTION_SCHEMA_PROPERTY, identifySheetSchema } from "./attribution-sheet-schema";
import {
  ATTRIBUTION_CODEBOOK_ROWS,
  migrateQuickEstimateAttribution,
} from "./attribution-migration";
import {
  verifyAttributionSourceProtection,
  type AttributionProtectionPort,
} from "./attribution-source-protection";
import {
  CONSULTATION_RESULT_OPTIONS,
  CONSULTATION_STATUS_OPTIONS,
} from "./consultation-sheet-schema";
import { LEAD_SHEET_COLUMN_DESCRIPTIONS, LEAD_SHEET_HEADERS, LEAD_STATUSES } from "./sheet-schema";

const TARGET_PROPERTY = "QUICK_ESTIMATE_PREPARATION_TARGET_ID";
const OWNER_PROPERTY = "QUICK_ESTIMATE_PREPARATION_OWNER_EMAIL";
const HEADER_COLOR = "#315CB6";
const DERIVED_COLOR = "#F3F4F6";
const QUEUE_WIDTHS = [
  110, 110, 190, 180, 120, 130, 220, 180, 90, 140, 190, 190, 130, 140, 160, 160, 220, 160,
];
const ASSIGNEE_FORMULA =
  '=OR(B2="",AND(LEN(TRIM(B2))<=30,REGEXMATCH(TRIM(B2),"^[가-힣A-Za-z][가-힣A-Za-z\\s·-]{0,29}$")))';
const DATE_FORMAT = "yyyy. mm. dd. am/pm h:mm";

/** 준비 대상의 별도 ID·소유자 확인과 값 보존 검사를 위한 읽기 전용 snapshot입니다. */
export type EmptyPreparationSnapshot = {
  configuredId: string | null;
  confirmedId: string | null;
  expectedOwner: string | null;
  owner: string;
  executor: string;
  sheetNames: string[];
  leads: string[][];
  queue: string[][];
  codebook: string[][];
  hasFormulas: boolean;
};

/** 업무 데이터가 있는 기존 환경·다른 계정·바뀐 계약에는 첫 쓰기 전에 중단합니다. */
export function assertEmptyPreparationTarget(snapshot: EmptyPreparationSnapshot): void {
  if (!snapshot.configuredId || snapshot.configuredId !== snapshot.confirmedId)
    throw new Error("preparation_target_not_confirmed");
  const expected = snapshot.expectedOwner?.trim().toLowerCase();
  if (
    !expected ||
    snapshot.owner.toLowerCase() !== expected ||
    snapshot.executor.toLowerCase() !== expected
  )
    throw new Error("preparation_owner_mismatch");
  if (
    JSON.stringify([...snapshot.sheetNames].sort()) !==
    JSON.stringify(["codebook", "leads", "상담 목록"].sort())
  )
    throw new Error("preparation_unexpected_sheet");
  if (snapshot.leads.length !== 1 || snapshot.queue.length !== 1 || snapshot.hasFormulas)
    throw new Error("preparation_requires_empty_storage");
  if (
    identifySheetSchema(snapshot.leads[0] ?? [], "leads") !== "attributed" ||
    identifySheetSchema(snapshot.queue[0] ?? [], "consultation") !== "attributed"
  )
    throw new Error("preparation_requires_attributed_headers");
  const expectedCodebook = [
    ["category", "code", "description"],
    ...LEAD_SHEET_HEADERS.map((name, i) => [
      "column",
      name,
      LEAD_SHEET_COLUMN_DESCRIPTIONS[i] ?? "",
    ]),
    ...LEAD_STATUSES.map((status) => ["lead_status", status, "허용 운영 상태"]),
    // 새 빈 템플릿은 v2 고지와 구분하도록 v1 설명을 명시했습니다. 기존 문구를 덮어쓰지 않습니다.
    ["privacy_notice_version", PRIVACY_NOTICE_VERSION, "기존 v1 요청용 개인정보 고지 버전"],
    ["marketing_consent_version", MARKETING_CONSENT_VERSION, "현재 선택 마케팅 활용 동의 버전"],
    ["retention", "P1Y", "접수일로부터 1년 보유 후 월 1회 파기 대상 확인"],
    ...ATTRIBUTION_CODEBOOK_ROWS,
  ];
  if (JSON.stringify(snapshot.codebook) !== JSON.stringify(expectedCodebook))
    throw new Error("preparation_codebook_mismatch");
}

function context() {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty(SPREADSHEET_ID_PROPERTY);
  if (!id || id !== properties.getProperty(TARGET_PROPERTY))
    throw new Error("preparation_target_not_confirmed");
  const book = SpreadsheetApp.openById(id);
  const named = (name: string) => {
    const sheet = book.getSheetByName(name);
    if (!sheet) throw new Error("preparation_sheet_missing");
    return sheet;
  };
  const leads = named("leads");
  const queue = named("상담 목록");
  const codebook = named("codebook");
  const owner = book.getOwner()?.getEmail() ?? "";
  const snapshot = (): EmptyPreparationSnapshot => ({
    configuredId: properties.getProperty(SPREADSHEET_ID_PROPERTY),
    confirmedId: properties.getProperty(TARGET_PROPERTY),
    expectedOwner: properties.getProperty(OWNER_PROPERTY),
    owner,
    executor: Session.getEffectiveUser().getEmail(),
    sheetNames: book.getSheets().map((sheet) => sheet.getName()),
    leads: leads.getDataRange().getDisplayValues(),
    queue: queue.getDataRange().getDisplayValues(),
    codebook: codebook.getDataRange().getDisplayValues(),
    hasFormulas: [leads, queue, codebook].some((sheet) =>
      sheet
        .getDataRange()
        .getFormulas()
        .some((row) => row.some(Boolean)),
    ),
  });
  // 이 검사 이전에는 설정·보호·값·표식에 쓰지 않습니다.
  if (leads.getLastRow() > 1 || queue.getLastRow() > 1 || codebook.getLastRow() > 40)
    throw new Error("preparation_requires_empty_storage");
  assertEmptyPreparationTarget(snapshot());
  if ([leads, queue, codebook].some((sheet) => sheet.getMaxRows() < 2))
    throw new Error("preparation_grid_too_small");
  return { properties, book, leads, queue, codebook, owner, snapshot };
}

type PreparationContext = ReturnType<typeof context>;

function baseProtections(c: PreparationContext) {
  return [
    { sheet: c.leads, range: c.leads.getRange("A1:AC1"), description: "Apps Script 관리 header" },
    {
      sheet: c.queue,
      range: c.queue.getRange("A1:R1"),
      description: "Apps Script 관리 상담 목록 header",
    },
    {
      sheet: c.queue,
      range: c.queue.getRange(2, 3, c.queue.getMaxRows() - 1, 9),
      description: "Apps Script 관리 원본 투영 컬럼",
    },
    {
      sheet: c.queue,
      range: c.queue.getRange(2, 14, c.queue.getMaxRows() - 1, 3),
      description: "Apps Script 관리 동의·식별 컬럼",
    },
    {
      sheet: c.codebook,
      range: c.codebook.getRange("A1:C40"),
      description: "Apps Script 관리 codebook",
    },
  ];
}

function protections(sheet: GoogleAppsScript.Spreadsheet.Sheet): AttributionProtectionPort[] {
  return sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
}

function preflightProtections(c: PreparationContext) {
  const filter = c.queue.getFilter()?.getRange();
  if (
    filter &&
    ![`A1:P${c.queue.getMaxRows()}`, `A1:R${c.queue.getMaxRows()}`].includes(filter.getA1Notation())
  )
    throw new Error("preparation_unrecognized_filter");
  const expected = [
    ...baseProtections(c),
    {
      sheet: c.leads,
      range: c.leads.getRange(1, 25, c.leads.getMaxRows(), 5),
      description: "Apps Script 관리 출처 컬럼",
    },
    {
      sheet: c.queue,
      range: c.queue.getRange(1, 17, c.queue.getMaxRows(), 2),
      description: "Apps Script 관리 출처 컬럼",
    },
  ];
  for (const sheet of [c.leads, c.queue, c.codebook]) {
    if (sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length)
      throw new Error("preparation_unrecognized_protection");
    const seen = new Set<string>();
    for (const protection of protections(sheet)) {
      const key = `${protection.getDescription()}|${protection.getRange().getA1Notation()}`;
      if (
        seen.has(key) ||
        !protection.canEdit() ||
        !expected.some(
          (item) =>
            item.sheet.getSheetId() === sheet.getSheetId() &&
            key === `${item.description}|${item.range.getA1Notation()}`,
        )
      )
        throw new Error("preparation_unrecognized_protection");
      seen.add(key);
    }
  }
}

function ownerOnly(protection: AttributionProtectionPort, owner: string): boolean {
  return (
    !protection.isWarningOnly() &&
    protection.canEdit() &&
    !protection.canDomainEdit() &&
    protection.getEditors().every((editor) => editor.getEmail() === owner) &&
    (protection.getTargetAudiences?.().length ?? 0) === 0
  );
}

function configureBase(c: PreparationContext) {
  for (const item of baseProtections(c)) {
    const protection: AttributionProtectionPort =
      protections(item.sheet).find(
        (p) =>
          p.getDescription() === item.description &&
          p.getRange().getA1Notation() === item.range.getA1Notation(),
      ) ?? item.range.protect();
    protection.setDescription(item.description);
    protection.setWarningOnly(false);
    protection.addEditors([c.owner]);
    protection.removeEditors(
      protection
        .getEditors()
        .map((user) => user.getEmail())
        .filter((email) => email !== c.owner),
    );
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
    for (const audience of protection.getTargetAudiences?.() ?? []) {
      if (!protection.removeTargetAudience) throw new Error("preparation_audience_permission");
      protection.removeTargetAudience(audience.getAudienceId());
    }
  }
  for (const [sheet, width, height] of [
    [c.leads, 29, 60],
    [c.queue, 18, 48],
    [c.codebook, 3, 36],
  ] as const) {
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, height);
    sheet
      .getRange(1, 1, 1, width)
      .setBackground(HEADER_COLOR)
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setWrap(true);
  }
  c.queue.setFrozenColumns(2);
  c.queue.setTabColor(HEADER_COLOR);
  QUEUE_WIDTHS.forEach((width, i) => c.queue.setColumnWidth(i + 1, width));
  const n = c.queue.getMaxRows() - 1;
  c.queue.getRange(2, 1, n, 18).setVerticalAlignment("middle");
  for (const [start, width] of [
    [1, 2],
    [12, 2],
  ] as const)
    c.queue.getRange(2, start, n, width).setBackground("#FFFFFF");
  for (const [start, width] of [
    [3, 9],
    [14, 5],
  ] as const)
    c.queue.getRange(2, start, n, width).setBackground(DERIVED_COLOR);
  c.queue.getRange(2, 6, n, 1).setNumberFormat("@");
  c.queue.getRange(2, 16, n, 1).setNumberFormat("@");
  c.queue.getRange(2, 9, n, 1).setNumberFormat('#,##0"명"');
  c.queue.getRange(2, 10, n, 1).setNumberFormat('#,##0"원"');
  c.leads.getRange(2, 13, c.leads.getMaxRows() - 1, 1).setNumberFormat("@");
  c.leads.getRange(2, 23, c.leads.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList([...LEAD_STATUSES], true)
      .setAllowInvalid(false)
      .build(),
  );
  c.leads.setColumnWidths(1, 29, 160);
  [180, 260, 760].forEach((width, i) => c.codebook.setColumnWidth(i + 1, width));
  c.codebook.getRange("A2:C40").setVerticalAlignment("middle").setWrap(true);
  c.codebook.setRowHeights(2, 39, 42);
  // 기존 함수는 검증·서식만 적용하며 trigger 생성은 별도 함수입니다.
  configureConsultationSheetAutomation(c.queue);
}

function requireCondition(ok: boolean, code: string): void {
  if (!ok) throw new Error(`preparation_readback_${code}`);
}

/** Google의 셀별 상대 참조 readback을 실제 행에 맞춰 비교하며 잘못된 행·허용값은 거부합니다. */
export function matchesPreparationValidation(
  actual: { type: string; values: unknown[]; allowInvalid: boolean } | null,
  expected: { type: string; values: unknown[]; rowNumber: number },
): boolean {
  // B2:B1000에 한 번 적용한 수식도 각 셀에서 읽으면 B3, B4 등으로 조정됩니다.
  const values =
    expected.type === "CUSTOM_FORMULA"
      ? expected.values.map((value) =>
          typeof value === "string" ? value.replace(/\bB2\b/gu, `B${expected.rowNumber}`) : value,
        )
      : expected.values;
  return (
    actual !== null &&
    !actual.allowInvalid &&
    actual.type === expected.type &&
    JSON.stringify(actual.values) === JSON.stringify(values)
  );
}

function verifyBase(c: PreparationContext) {
  preflightProtections(c);
  requireCondition(
    c.book.getSpreadsheetLocale() === "ko_KR" && c.book.getSpreadsheetTimeZone() === "Asia/Seoul",
    "locale",
  );
  for (const item of baseProtections(c))
    requireCondition(
      protections(item.sheet).some(
        (p) =>
          p.getDescription() === item.description &&
          p.getRange().getA1Notation() === item.range.getA1Notation() &&
          ownerOnly(p, c.owner),
      ),
      "protection",
    );
  for (const [sheet, width, height] of [
    [c.leads, 29, 60],
    [c.queue, 18, 48],
    [c.codebook, 3, 36],
  ] as const) {
    const header = sheet.getRange(1, 1, 1, width);
    requireCondition(
      sheet.getFrozenRows() === 1 &&
        sheet.getRowHeight(1) === height &&
        header.getBackgrounds()[0]?.every((v) => v.toUpperCase() === HEADER_COLOR) === true &&
        header.getFontColors()[0]?.every((v) => v.toUpperCase() === "#FFFFFF") === true &&
        header.getFontWeights()[0]?.every((v) => v === "bold") === true &&
        header.getWraps()[0]?.every(Boolean) === true,
      "header_format",
    );
  }
  requireCondition(
    c.queue.getFrozenColumns() === 2 &&
      QUEUE_WIDTHS.every((width, i) => c.queue.getColumnWidth(i + 1) === width),
    "queue_layout",
  );
  requireCondition(
    Array.from({ length: 29 }, (_, i) => c.leads.getColumnWidth(i + 1)).every(
      (width) => width === 160,
    ) && [180, 260, 760].every((width, i) => c.codebook.getColumnWidth(i + 1) === width),
    "reference_layout",
  );
  for (const [start, width, color] of [
    [1, 2, "#FFFFFF"],
    [12, 2, "#FFFFFF"],
    [3, 9, DERIVED_COLOR],
    [14, 5, DERIVED_COLOR],
  ] as const)
    requireCondition(
      c.queue
        .getRange(2, start, c.queue.getMaxRows() - 1, width)
        .getBackgrounds()
        .every((row) => row.every((value) => value.toUpperCase() === color)),
      "body_format",
    );
  const numbers: [GoogleAppsScript.Spreadsheet.Sheet, number, string][] = [
    [c.leads, 13, "@"],
    [c.queue, 6, "@"],
    [c.queue, 16, "@"],
    [c.queue, 9, '#,##0"명"'],
    [c.queue, 10, '#,##0"원"'],
    [c.queue, 12, DATE_FORMAT],
  ];
  for (const [sheet, column, format] of numbers)
    requireCondition(
      sheet
        .getRange(2, column, sheet.getMaxRows() - 1, 1)
        .getNumberFormats()
        .every((row) => row[0] === format),
      "number_format",
    );
  const validators: [
    GoogleAppsScript.Spreadsheet.Sheet,
    number,
    keyof typeof GoogleAppsScript.Spreadsheet.DataValidationCriteria,
    unknown[],
  ][] = [
    [c.leads, 23, "VALUE_IN_LIST", [[...LEAD_STATUSES], true]],
    [c.queue, 1, "VALUE_IN_LIST", [[...CONSULTATION_STATUS_OPTIONS], true]],
    [c.queue, 2, "CUSTOM_FORMULA", [ASSIGNEE_FORMULA]],
    [c.queue, 12, "DATE_IS_VALID_DATE", []],
    [c.queue, 13, "VALUE_IN_LIST", [[...CONSULTATION_RESULT_OPTIONS], true]],
  ];
  for (const [sheet, column, type, values] of validators) {
    const rules = sheet.getRange(2, column, sheet.getMaxRows() - 1, 1).getDataValidations();
    for (const [index, row] of rules.entries()) {
      const rule = row[0];
      const actual = rule
        ? {
            type: String(rule.getCriteriaType()),
            values: rule.getCriteriaValues(),
            allowInvalid: rule.getAllowInvalid(),
          }
        : null;
      // 빈 시트의 검증 규칙만 진단하며 셀 값·연락처·문서 ID는 포함하지 않습니다.
      requireCondition(
        matchesPreparationValidation(actual, { type, values, rowNumber: index + 2 }),
        `validation_${column}_row_${index + 2}_${JSON.stringify(actual)}`,
      );
    }
  }
  const colors = ["#FFF3CD", "#DDEBFF", "#DDF4E4", "#E5E7EB"];
  const rules = c.queue.getConditionalFormatRules();
  requireCondition(
    rules.length === 4 &&
      rules.every((rule, i) => {
        const condition = rule.getBooleanCondition();
        return (
          condition !== null &&
          String(condition.getCriteriaType()) === "TEXT_EQUAL_TO" &&
          JSON.stringify(condition.getCriteriaValues()) ===
            JSON.stringify([CONSULTATION_STATUS_OPTIONS[i]]) &&
          condition.getBackground()?.toUpperCase() === colors[i] &&
          rule.getRanges().length === 1 &&
          rule.getRanges()[0]?.getA1Notation() === `A2:A${c.queue.getMaxRows()}`
        );
      }),
    "status_colors",
  );
}

/** 별도 준비 bundle에서만 실행합니다. 접수 데이터·메일·트리거·웹앱을 생성하지 않습니다. */
export function prepareEmptyQuickEstimateStorage() {
  const c = context();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MILLISECONDS)) throw new Error("preparation_lock_unavailable");
  try {
    assertEmptyPreparationTarget(c.snapshot());
    preflightProtections(c);
    c.properties.setProperty(ATTRIBUTION_SCHEMA_PROPERTY, "pending");
    const before = JSON.stringify(c.snapshot());
    configureBase(c);
    SpreadsheetApp.flush();
    verifyBase(c);
    requireCondition(JSON.stringify(c.snapshot()) === before, "values_changed");
  } finally {
    lock.releaseLock();
  }
  try {
    assertEmptyPreparationTarget(c.snapshot());
    migrateQuickEstimateAttribution();
    return verifyEmptyQuickEstimateStorage();
  } catch (error) {
    c.properties.setProperty(ATTRIBUTION_SCHEMA_PROPERTY, "pending");
    throw error;
  }
}

/** Google에서 설정·보호·계약을 다시 읽는 무쓰기 검증이며 개인정보나 ID를 로그에 남기지 않습니다. */
export function verifyEmptyQuickEstimateStorage() {
  const c = context();
  verifyBase(c);
  const filter = c.queue.getFilter()?.getRange();
  requireCondition(
    filter?.getA1Notation() === `A1:R${c.queue.getMaxRows()}` && c.queue.isColumnHiddenByUser(16),
    "source_layout",
  );
  for (const [sheet, start, width] of [
    [c.leads, 25, 5],
    [c.queue, 17, 2],
  ] as const)
    requireCondition(
      verifyAttributionSourceProtection(
        sheet.getRange(1, start, sheet.getMaxRows(), width),
        protections(sheet),
        [c.owner],
      ),
      "source_protection",
    );
  requireCondition(c.properties.getProperty(ATTRIBUTION_SCHEMA_PROPERTY) === "2", "schema_marker");
  const report = {
    status: "verified",
    schema: "2",
    leadRows: 0,
    consultationRows: 0,
    codebookRows: 40,
    leadColumns: 29,
    consultationColumns: 18,
    protectedRanges: baseProtections(c).length + 2,
    ownerOnly: true,
    validations: 5,
    conditionalFormats: 4,
    locale: "ko_KR",
    timeZone: "Asia/Seoul",
    sideEffects: "configuration-only; no submission, mail, trigger or deployment",
  };
  console.log(JSON.stringify(report));
  return report;
}
