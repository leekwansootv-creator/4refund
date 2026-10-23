import { ATTRIBUTED_LEAD_HEADERS, type LeadSheetRow } from "./sheet-schema";
import {
  ATTRIBUTED_CONSULTATION_HEADERS,
  buildConsultationSourceCells,
} from "./consultation-sheet-schema";
import { ATTRIBUTION_SCHEMA_PROPERTY, identifySheetSchema } from "./attribution-sheet-schema";
import { SPREADSHEET_ID_PROPERTY, LOCK_TIMEOUT_MILLISECONDS } from "./apps-script-config";
import {
  configureAttributionSourceProtection,
  verifyAttributionSourceProtection,
} from "./attribution-source-protection";

/** 출처 확장의 codebook 항목이며 기존 보유·권한 정책을 덮어쓰지 않습니다. */
export const ATTRIBUTION_CODEBOOK_ROWS = [
  ["column", "submission_version", "25열. 확장 전 빈칸, 구 요청 1, 출처 요청 2"],
  ["column", "source_channel", "26열. homepage/embed/hosted/legacy_unknown. 인증 아님"],
  ["column", "source_domain", "27열. 소문자 ASCII 도메인, www·하위 도메인 유지. 미확인 빈칸"],
  ["column", "source_origin", "28열. 정규화 origin. 경로·query·fragment 수집 안 함"],
  [
    "column",
    "source_method",
    "29열. parent_message/referrer/self_location/configured/unknown/legacy_absent",
  ],
  ["source", "history", "확장 전 원본 빈칸은 과거 미수집. 근거 없는 출처 backfill 금지"],
  ["source", "trust", "외부 요청자가 출처 문자열을 조작할 수 있음. 인증·정산에 사용 금지"],
  [
    "privacy_notice_version",
    "privacy-2026-10-23-v2",
    "출처 정보를 포함한 v2 제출 전용 개인정보 고지. 기존 v1 요청 고지도 계속 지원",
  ],
] as const;

/** 여러 탭의 비원자적 변경을 readback 전까지 비활성 상태로 유지하는 migration port입니다. */
export type AttributionMigrationPort = {
  withLock: <T>(operation: () => T) => T;
  read: () => {
    leadHeaders: string[];
    consultationHeaders: string[];
    leadRows: LeadSheetRow[];
    consultationRows: string[][];
    codebook: string[][];
  };
  setEnabled: (enabled: boolean) => void;
  writeHeaders: () => void;
  appendCodebook: (rows: string[][]) => void;
  writeSource: (row: number, cells: [string, string]) => void;
  configure: () => void;
  flush: () => void;
  verifyConfiguration: () => boolean;
  preflightConfiguration?: () => void;
};

function preflight(snapshot: ReturnType<AttributionMigrationPort["read"]>) {
  identifySheetSchema(snapshot.leadHeaders, "leads");
  identifySheetSchema(snapshot.consultationHeaders, "consultation");
  const ids = new Set<string>();
  const requests = new Set<string>();
  for (const row of snapshot.leadRows) {
    const id = String(row[0] ?? "");
    const request = String(row[1] ?? "");
    if (!id || !request || ids.has(id) || requests.has(request))
      throw new Error("migration_duplicate_or_missing_id");
    ids.add(id);
    requests.add(request);
    if (row.slice(29).some((cell) => cell !== ""))
      throw new Error("migration_unrecognized_lead_columns");
    if (
      identifySheetSchema(snapshot.leadHeaders, "leads") === "legacy" &&
      row.slice(24).some((cell) => cell !== "")
    )
      throw new Error("migration_unheaded_lead_data");
  }
  const queueIds = new Set<string>();
  for (const row of snapshot.consultationRows) {
    const id = row[15];
    if (!id || queueIds.has(id) || !ids.has(id))
      throw new Error("migration_unmatched_consultation_id");
    queueIds.add(id);
    if (
      row.slice(18).some(Boolean) ||
      (identifySheetSchema(snapshot.consultationHeaders, "consultation") === "legacy" &&
        row.slice(16).some(Boolean))
    )
      throw new Error("migration_unrecognized_consultation_data");
  }
  const missing: string[][] = [];
  if (snapshot.codebook[0]?.join("|") !== "category|code|description")
    throw new Error("migration_codebook_header");
  for (const row of ATTRIBUTION_CODEBOOK_ROWS) {
    const existing = snapshot.codebook.filter(
      (entry) => entry[0] === row[0] && entry[1] === row[1],
    );
    if (existing.length > 1 || (existing.length === 1 && existing[0]?.join("|") !== row.join("|")))
      throw new Error("migration_codebook_conflict");
    if (!existing.length) missing.push([...row]);
  }
  return missing;
}

/** 사전 검사 후 추가 열만 쓰며, 실패한 migration은 같은 함수로 재개할 수 있습니다. */
export function migrateAttributionSchema(port: AttributionMigrationPort): { sourceRows: number } {
  return port.withLock(() => {
    const snapshot = port.read();
    const missing = preflight(snapshot);
    port.preflightConfiguration?.();
    port.setEnabled(false);
    port.writeHeaders();
    if (missing.length) port.appendCodebook(missing);
    const leads = new Map(snapshot.leadRows.map((row) => [String(row[0]), row]));
    snapshot.consultationRows.forEach((row, index) => {
      const lead = leads.get(row[15] ?? "");
      if (lead) port.writeSource(index + 2, buildConsultationSourceCells(lead));
    });
    port.configure();
    port.flush();
    const readback = port.read();
    // 수동 편집은 Script lock 밖에서도 가능하므로 ID·행 수·기존 값의 보존도 확인합니다.
    const sameExistingRows = (
      before: readonly LeadSheetRow[],
      after: readonly LeadSheetRow[],
      width: number,
    ) =>
      before.length === after.length &&
      before.every(
        (row, index) =>
          JSON.stringify(Array.from({ length: width }, (_, column) => row[column] ?? "")) ===
          JSON.stringify(
            Array.from({ length: width }, (_, column) => after[index]?.[column] ?? ""),
          ),
      );
    if (
      !sameExistingRows(snapshot.leadRows, readback.leadRows, 29) ||
      !sameExistingRows(snapshot.consultationRows, readback.consultationRows, 16)
    )
      throw new Error("migration_existing_data_changed");
    if (
      preflight(readback).length ||
      identifySheetSchema(readback.leadHeaders, "leads") !== "attributed" ||
      identifySheetSchema(readback.consultationHeaders, "consultation") !== "attributed" ||
      !port.verifyConfiguration()
    )
      throw new Error("migration_readback_failed");
    for (const row of readback.consultationRows) {
      const lead = leads.get(row[15] ?? "");
      if (!lead || row.slice(16, 18).join("|") !== buildConsultationSourceCells(lead).join("|"))
        throw new Error("migration_source_readback_failed");
    }
    port.setEnabled(true);
    return { sourceRows: snapshot.consultationRows.length };
  });
}

/** 운영 승인 후 수동 실행할 migration이며 일반 POST·setup에서는 호출하지 않습니다. */
export function migrateQuickEstimateAttribution(): { sourceRows: number } {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty(SPREADSHEET_ID_PROPERTY);
  if (!id) throw new Error("spreadsheet_not_configured");
  const book = SpreadsheetApp.openById(id);
  const leads = book.getSheetByName("leads");
  const queue = book.getSheetByName("상담 목록");
  const codebook = book.getSheetByName("codebook");
  if (!leads || !queue || !codebook) throw new Error("migration_sheet_missing");
  const readSheet = (sheet: GoogleAppsScript.Spreadsheet.Sheet) =>
    sheet.getDataRange().getDisplayValues();
  const effectiveEmail = Session.getEffectiveUser().getEmail();
  if (!effectiveEmail) throw new Error("migration_editor_identity_missing");
  const allowedEditors = [
    ...new Set(
      [effectiveEmail, book.getOwner()?.getEmail()].filter((email): email is string =>
        Boolean(email),
      ),
    ),
  ];
  const configureSource = (
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    start: number,
    width: number,
  ) => {
    const range = sheet.getRange(1, start, sheet.getMaxRows(), width);
    configureAttributionSourceProtection(
      range,
      sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE),
      allowedEditors,
    );
  };
  return migrateAttributionSchema({
    preflightConfiguration: () => {
      const range = queue.getFilter()?.getRange();
      if (
        range &&
        (range.getRow() !== 1 ||
          range.getColumn() !== 1 ||
          ![16, 18].includes(range.getNumColumns()))
      )
        throw new Error("migration_unrecognized_filter");
    },
    withLock: (operation) => {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(LOCK_TIMEOUT_MILLISECONDS)) throw new Error("migration_lock_unavailable");
      try {
        return operation();
      } finally {
        lock.releaseLock();
      }
    },
    read: () => {
      const l = readSheet(leads);
      const q = readSheet(queue);
      return {
        leadHeaders: l[0] ?? [],
        consultationHeaders: q[0] ?? [],
        leadRows: l.slice(1),
        consultationRows: q.slice(1),
        codebook: readSheet(codebook),
      };
    },
    setEnabled: (enabled) => {
      properties.setProperty(ATTRIBUTION_SCHEMA_PROPERTY, enabled ? "2" : "pending");
    },
    writeHeaders: () => {
      if (leads.getMaxColumns() < 29)
        leads.insertColumnsAfter(leads.getMaxColumns(), 29 - leads.getMaxColumns());
      if (queue.getMaxColumns() < 18)
        queue.insertColumnsAfter(queue.getMaxColumns(), 18 - queue.getMaxColumns());
      leads.getRange(1, 25, 1, 5).setValues([ATTRIBUTED_LEAD_HEADERS.slice(24)]);
      queue.getRange(1, 17, 1, 2).setValues([ATTRIBUTED_CONSULTATION_HEADERS.slice(16)]);
    },
    appendCodebook: (rows) => {
      codebook.getRange(codebook.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
    },
    writeSource: (row, cells) => {
      queue.getRange(row, 17, 1, 2).setValues([cells]);
    },
    configure: () => {
      configureSource(leads, 25, 5);
      configureSource(queue, 17, 2);
      queue.setColumnWidth(17, 220);
      queue.setColumnWidth(18, 160);
      queue.hideColumns(16);
      const filter = queue.getFilter();
      const criteria = Array.from(
        { length: Math.min(filter?.getRange().getNumColumns() ?? 16, 18) },
        (_, index) => filter?.getColumnFilterCriteria(index + 1) ?? null,
      );
      filter?.remove();
      const next = queue.getRange(1, 1, queue.getMaxRows(), 18).createFilter();
      criteria.forEach((criterion, index) => {
        if (criterion) next.setColumnFilterCriteria(index + 1, criterion);
      });
    },
    flush: () => SpreadsheetApp.flush(),
    verifyConfiguration: () => {
      const filter = queue.getFilter()?.getRange();
      return (
        filter?.getRow() === 1 &&
        filter.getColumn() === 1 &&
        filter.getNumColumns() === 18 &&
        filter.getNumRows() === queue.getMaxRows() &&
        queue.getColumnWidth(17) === 220 &&
        queue.getColumnWidth(18) === 160 &&
        queue.isColumnHiddenByUser(16) &&
        verifyAttributionSourceProtection(
          leads.getRange(1, 25, leads.getMaxRows(), 5),
          leads.getProtections(SpreadsheetApp.ProtectionType.RANGE),
          allowedEditors,
        ) &&
        verifyAttributionSourceProtection(
          queue.getRange(1, 17, queue.getMaxRows(), 2),
          queue.getProtections(SpreadsheetApp.ProtectionType.RANGE),
          allowedEditors,
        )
      );
    },
  });
}
