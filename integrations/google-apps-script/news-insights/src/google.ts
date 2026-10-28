import {
  NEWS_HEADERS,
  SNAPSHOT_HEADERS,
  recordFromRow,
  recordToRow,
  snapshotFromRow,
  snapshotToRow,
  type NewsRecord,
} from "./model";
import type { NewsPort } from "./service";

const MAX_ARTICLES = 100;
const MAX_SNAPSHOTS = 300;

function settings() {
  return PropertiesService.getScriptProperties();
}
function spreadsheet() {
  const id = settings().getProperty("NEWS_SPREADSHEET_ID");
  if (!id || !/^[a-zA-Z0-9_-]{20,100}$/u.test(id))
    throw new Error("뉴스 문서 설정을 확인해 주세요.");
  return SpreadsheetApp.openById(id);
}
function tab(name: string, headers: readonly string[], limit: number) {
  const sheet = spreadsheet().getSheetByName(name);
  if (
    !sheet ||
    sheet.getLastColumn() !== headers.length ||
    sheet.getLastRow() > limit + 1 ||
    sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0]?.join("\t") !== headers.join("\t")
  )
    throw new Error("뉴스 탭의 헤더 또는 용량을 확인해 주세요.");
  return sheet;
}
function rows(name: string, headers: readonly string[], limit: number) {
  const sheet = tab(name, headers, limit);
  const count = sheet.getLastRow() - 1;
  if (!count) return [];
  const range = sheet.getRange(2, 1, count, headers.length);
  if (range.getFormulas().some((row) => row.some(Boolean)))
    throw new Error("뉴스 관리 데이터에는 수식을 사용할 수 없습니다.");
  return range.getDisplayValues();
}
function unique<T extends { id: string }>(values: T[]): T[] {
  if (new Set(values.map((value) => value.id)).size !== values.length)
    throw new Error("중복된 뉴스 식별자를 확인해 주세요.");
  return values;
}
function writeRow(sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number, values: string[]) {
  // 외부 제목의 =/+/-/@도 수식이 되지 않도록 문자열로 기록한다. 읽기는 표시값만 사용한다.
  const range = sheet.getRange(row, 1, 1, values.length);
  range.setNumberFormat("@");
  range.setValues([values.map((value) => (value ? "'" + value : ""))]);
  SpreadsheetApp.flush();
}

/** 명시 허용 계정이며 현재 문서의 사용자 실행인 경우에만 관리 RPC를 허용한다. */
export function authorizeNewsEditor() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const effective = Session.getEffectiveUser().getEmail().toLowerCase();
  const allowed = (settings().getProperty("NEWS_EDITOR_EMAILS") ?? "")
    .toLowerCase()
    .split(",")
    .map((part) => part.trim());
  if (
    !email ||
    email !== effective ||
    !allowed.includes(email) ||
    SpreadsheetApp.getActiveSpreadsheet()?.getId() !== settings().getProperty("NEWS_SPREADSHEET_ID")
  )
    throw new Error("뉴스 관리 권한 또는 현재 문서를 확인해 주세요.");
}

/** Sheet 전체 권한이 있어도 이 어댑터는 고정된 뉴스 두 탭만 읽고 쓴다. */
export function googleNewsPort(): NewsPort {
  return {
    authorize: authorizeNewsEditor,
    lock(work) {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(5000))
        throw new Error("다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.");
      try {
        return work();
      } finally {
        lock.releaseLock();
      }
    },
    records: readNewsRecords,
    snapshots: readNewsSnapshots,
    write(record, creating = false) {
      const sheet = tab("뉴스 관리", NEWS_HEADERS, MAX_ARTICLES);
      const existing = rows("뉴스 관리", NEWS_HEADERS, MAX_ARTICLES);
      const index = existing.findIndex((row) => row[0] === record.id);
      if (creating ? index !== -1 || existing.length >= MAX_ARTICLES : index === -1)
        throw new Error("뉴스 행 또는 저장 용량을 확인해 주세요.");
      writeRow(sheet, creating ? existing.length + 2 : index + 2, recordToRow(record));
    },
    appendSnapshot(snapshot) {
      const sheet = tab("뉴스 게시본", SNAPSHOT_HEADERS, MAX_SNAPSHOTS);
      if (sheet.getLastRow() > MAX_SNAPSHOTS) throw new Error("게시본 저장 용량을 확인해 주세요.");
      writeRow(sheet, sheet.getLastRow() + 1, snapshotToRow(snapshot));
    },
    extract(url, imageOnly) {
      const properties = settings();
      const endpoint = properties.getProperty("NEWS_EXTRACTOR_URL") ?? "";
      const token = properties.getProperty("NEWS_EXTRACTOR_TOKEN") ?? "";
      if (
        !/^https:\/\/(?:[a-z0-9-]+\.)+[a-z]{2,63}\/extract$/iu.test(endpoint) ||
        token.length < 32 ||
        token.length > 256 ||
        !/^[\x21-\x7e]+$/u.test(token)
      )
        throw new Error("수집 서비스 주소와 인증 설정이 필요합니다.");
      const response = UrlFetchApp.fetch(endpoint, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify({ url, imageOnly }),
        followRedirects: false,
        muteHttpExceptions: true,
        validateHttpsCertificates: true,
      });
      if (response.getResponseCode() !== 200 || response.getBlob().getBytes().length > 110_000)
        throw new Error(
          "가져오지 못했습니다. 기존 편집값은 유지됩니다. 잠시 후 다시 시도해 주세요.",
        );
      return JSON.parse(response.getContentText("UTF-8")) as unknown;
    },
    etag(record: NewsRecord) {
      return Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        JSON.stringify(recordToRow(record)),
        Utilities.Charset.UTF_8,
      )
        .map((byte) => (byte & 255).toString(16).padStart(2, "0"))
        .join("");
    },
    uuid: () => Utilities.getUuid(),
    now: () => new Date().toISOString(),
  };
}

/** 관리 프로젝트에서 고정 뉴스 탭을 읽고 공유 모델 계약으로 검증한다. */
export function readNewsRecords() {
  return unique(rows("뉴스 관리", NEWS_HEADERS, MAX_ARTICLES).map(recordFromRow));
}

/** 공개 후보는 고정된 게시본 탭의 불변 행에서만 읽는다. */
export function readNewsSnapshots() {
  return unique(rows("뉴스 게시본", SNAPSHOT_HEADERS, MAX_SNAPSHOTS).map(snapshotFromRow));
}
