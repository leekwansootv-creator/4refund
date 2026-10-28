/** 뉴스 전용 탭. 상담·leads·codebook은 이 integration에서 참조하지 않는다. */
export const NEWS_HEADERS = [
  "기사 ID",
  "기사 URL",
  "편집 제목",
  "상태",
  "최초 게시일",
  "수정일",
  "버전",
  "가져오기 상태",
  "후보 제목",
  "최종 원문 URL",
  "원문 지문",
  "수집일",
  "게시본 ID",
  "편집 이미지 1",
  "편집 이미지 2",
  "후보 이미지 1",
  "후보 이미지 2",
] as const;
/** 게시 스냅샷은 먼저 추가하고 관리 행의 게시본 ID를 마지막에 전환한다. */
export const SNAPSHOT_HEADERS = [
  "게시본 ID",
  "기사 ID",
  "게시 제목",
  "기사 URL",
  "최초 게시일",
  "저장일",
  "이미지 1",
  "이미지 2",
] as const;
/** Sheets 셀 50,000자 한도 안에서 JPEG를 두 셀로 분할한다. */
export const IMAGE_LIMIT = 95_576;
/** 후보, 편집본과 게시본 참조를 분리한 내부 뉴스 레코드. */
export type NewsRecord = {
  id: string;
  url: string;
  title: string;
  status: "초안" | "게시" | "숨김";
  firstPublishedAt: string;
  updatedAt: string;
  version: number;
  warning: string;
  candidateTitle: string;
  resolvedUrl: string;
  fingerprint: string;
  fetchedAt: string;
  snapshotId: string;
  image: string;
  candidateImage: string;
};
/** 공개 참조가 연결되기 전에는 방문자에게 노출하지 않는 스냅샷. */
export type Snapshot = {
  id: string;
  articleId: string;
  title: string;
  url: string;
  firstPublishedAt: string;
  savedAt: string;
  image: string;
};
/** 인증된 수집 서비스의 제한된 응답. HTML 원문·자격 증명은 받지 않는다. */
export type Candidate = {
  url: string;
  title: string;
  image: string | null;
  warning: string | null;
  fingerprint: string;
};
/** 홈페이지가 받을 수 있는 필드는 이 네 개뿐이다. */
export type PublicCard = { id: string; title: string; url: string; imageUrl: string | null };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu;
const WARNINGS = new Set([
  "",
  "TITLE_MISSING",
  "IMAGE_MISSING",
  "IMAGE_UNAVAILABLE",
  "SOURCE_CHANGED",
]);

/** Google V8에 없는 URL 전역에 의존하지 않고 공개 도메인 URL 문법을 제한한다. */
export function normalizeNewsUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/u.test(value))
    throw new Error("올바른 공개 기사 URL을 입력해 주세요.");
  const match = /^(https?):\/\/([a-z0-9.-]+)(?::(\d+))?([/?][^#]*)?(?:#.*)?$/iu.exec(value);
  if (!match) throw new Error("HTTP(S) 공개 도메인만 사용할 수 있습니다.");
  const scheme = match[1]!.toLowerCase(),
    host = match[2]!.toLowerCase();
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/u.test(host) ||
    /\.(?:localhost|local|internal|test)$/u.test(host) ||
    (match[3] && match[3] !== (scheme === "https" ? "443" : "80"))
  )
    throw new Error("공개 도메인의 기본 포트만 사용할 수 있습니다.");
  let tail = match[4] || "/";
  if (!tail.startsWith("/")) tail = "/" + tail;
  tail = tail.replace(/[^\u0000-\u007f]/gu, (character) => encodeURIComponent(character));
  const result = `${scheme}://${host}${tail}`;
  if (result.length > 2048) throw new Error("URL이 너무 깁니다.");
  return result;
}

function title(value: unknown, required = false): string {
  if (
    typeof value !== "string" ||
    [...value].length > 300 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
  )
    throw new Error("제목은 300자 이하 텍스트로 입력해 주세요.");
  const result = value.trim().replace(/\s+/gu, " ");
  if (required && !result) throw new Error("게시하려면 제목이 필요합니다.");
  return result;
}

/** 수집기에서 디코드·재인코딩한 JPEG만 보관한다. 직접 임의 data URL을 입력받지 않는다. */
export function checkedImage(value: unknown): string {
  if (value === "" || value === null) return "";
  if (
    typeof value !== "string" ||
    value.length > IMAGE_LIMIT ||
    value.length % 4 !== 0 ||
    !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/u.test(value)
  )
    throw new Error("검증된 JPEG 이미지가 아닙니다.");
  return value;
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value))
    throw new Error("기사 식별자를 확인해 주세요.");
  return value;
}
function timestamp(value: string, optional = false): string {
  if (optional && !value) return "";
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("뉴스 날짜 형식이 올바르지 않습니다.");
  return value;
}

/** 목록/읽기는 모든 관리 행을 검증하며 잘못된 수동 셀 편집을 성공처럼 처리하지 않는다. */
export function recordFromRow(row: readonly string[]): NewsRecord {
  if (row.length !== NEWS_HEADERS.length) throw new Error("뉴스 열 구성이 다릅니다.");
  const status = row[3];
  if (status !== "초안" && status !== "게시" && status !== "숨김")
    throw new Error("뉴스 상태가 올바르지 않습니다.");
  const version = Number(row[6]);
  if (!Number.isSafeInteger(version) || version < 1)
    throw new Error("뉴스 버전이 올바르지 않습니다.");
  if (!WARNINGS.has(row[7]!)) throw new Error("수집 상태가 올바르지 않습니다.");
  const snapshotId = row[12] ? identifier(row[12]) : "";
  if (status !== "초안" && (!snapshotId || !row[4])) throw new Error("게시본 연결이 없습니다.");
  return {
    id: identifier(row[0]),
    url: normalizeNewsUrl(row[1]),
    title: title(row[2]),
    status,
    firstPublishedAt: timestamp(row[4]!, true),
    updatedAt: timestamp(row[5]!),
    version,
    warning: row[7]!,
    candidateTitle: title(row[8]),
    resolvedUrl: row[9] ? normalizeNewsUrl(row[9]) : "",
    fingerprint: row[10]!,
    fetchedAt: timestamp(row[11]!, true),
    snapshotId,
    image: checkedImage(row[13]! + row[14]!),
    candidateImage: checkedImage(row[15]! + row[16]!),
  };
}

/** 이미지 청크를 포함한 관리 행 전체를 한 번의 setValues로 바꾼다. */
export function recordToRow(record: NewsRecord): string[] {
  return [
    record.id,
    record.url,
    record.title,
    record.status,
    record.firstPublishedAt,
    record.updatedAt,
    String(record.version),
    record.warning,
    record.candidateTitle,
    record.resolvedUrl,
    record.fingerprint,
    record.fetchedAt,
    record.snapshotId,
    record.image.slice(0, 48_000),
    record.image.slice(48_000),
    record.candidateImage.slice(0, 48_000),
    record.candidateImage.slice(48_000),
  ];
}

/** URL 정규화 후 초안을 만든다. 기사 등록은 공개 전송이 아니다. */
export function createRecord(id: string, url: unknown, now: string): NewsRecord {
  return {
    id: identifier(id),
    url: normalizeNewsUrl(url),
    title: "",
    status: "초안",
    firstPublishedAt: "",
    updatedAt: timestamp(now),
    version: 1,
    warning: "",
    candidateTitle: "",
    resolvedUrl: "",
    fingerprint: "",
    fetchedAt: "",
    snapshotId: "",
    image: "",
    candidateImage: "",
  };
}

/** 원문 URL과 확인한 최종 URL의 교차 중복을 거절한다. */
export function assertUnique(records: readonly NewsRecord[], url: string, except = ""): void {
  if (
    records.some(
      (record) => record.id !== except && (record.url === url || record.resolvedUrl === url),
    )
  )
    throw new Error("이미 등록된 기사입니다. 기존 기사를 선택해 주세요.");
}

/** 재수집 후보만 변경하고 수동 편집값과 공개 스냅샷은 유지한다. */
export function applyCandidate(
  record: NewsRecord,
  value: unknown,
  now: string,
  imageOnly = false,
): NewsRecord {
  if (!value || typeof value !== "object") throw new Error("수집 응답이 올바르지 않습니다.");
  const candidate = value as Partial<Candidate>;
  if (
    Object.keys(candidate).sort().join() !== "fingerprint,image,title,url,warning" ||
    typeof candidate.fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/u.test(candidate.fingerprint) ||
    !WARNINGS.has(candidate.warning ?? "")
  )
    throw new Error("수집 응답이 올바르지 않습니다.");
  normalizeNewsUrl(candidate.url);
  title(candidate.title);
  const changed = !!record.fingerprint && record.fingerprint !== candidate.fingerprint;
  return {
    ...record,
    resolvedUrl: imageOnly ? record.resolvedUrl : normalizeNewsUrl(candidate.url),
    candidateTitle: imageOnly ? record.candidateTitle : title(candidate.title),
    candidateImage: checkedImage(candidate.image),
    fingerprint: imageOnly ? record.fingerprint : candidate.fingerprint,
    warning: !imageOnly && changed ? "SOURCE_CHANGED" : candidate.warning || "",
    fetchedAt: timestamp(now),
    updatedAt: now,
    version: record.version + 1,
  };
}

/** 선택한 후보를 명시적으로 채택하거나 이미지를 제거한다. 게시본은 바꾸지 않는다. */
export function editRecord(
  record: NewsRecord,
  value: unknown,
  imageChoice: unknown,
  now: string,
): NewsRecord {
  if (!["keep", "candidate", "remove"].includes(String(imageChoice)))
    throw new Error("이미지 선택이 올바르지 않습니다.");
  if (imageChoice === "candidate" && !record.candidateImage)
    throw new Error("이미지 후보가 없습니다.");
  return {
    ...record,
    title: title(value),
    image:
      imageChoice === "candidate"
        ? record.candidateImage
        : imageChoice === "remove"
          ? ""
          : record.image,
    version: record.version + 1,
    updatedAt: timestamp(now),
  };
}

/** 공개 전환은 스냅샷을 먼저 저장한 뒤 이 관리 행을 저장해야 완료된다. */
export function preparePublication(
  record: NewsRecord,
  snapshotId: string,
  now: string,
): { record: NewsRecord; snapshot: Snapshot } {
  const first = record.firstPublishedAt || timestamp(now);
  const snapshot: Snapshot = {
    id: identifier(snapshotId),
    articleId: record.id,
    title: title(record.title, true),
    url: record.url,
    firstPublishedAt: first,
    savedAt: now,
    image: checkedImage(record.image),
  };
  return {
    snapshot,
    record: {
      ...record,
      status: "게시",
      firstPublishedAt: first,
      snapshotId,
      updatedAt: now,
      version: record.version + 1,
    },
  };
}

/** 숨김은 참조를 보존하며 최초 게시시각을 바꾸지 않는다. */
export function hideRecord(record: NewsRecord, now: string): NewsRecord {
  if (record.status === "초안") throw new Error("아직 게시하지 않은 기사입니다.");
  return { ...record, status: "숨김", updatedAt: timestamp(now), version: record.version + 1 };
}

/** 스냅샷의 이미지도 셀 한도를 넘지 않게 두 청크로 저장한다. */
export function snapshotToRow(snapshot: Snapshot): string[] {
  return [
    snapshot.id,
    snapshot.articleId,
    snapshot.title,
    snapshot.url,
    snapshot.firstPublishedAt,
    snapshot.savedAt,
    snapshot.image.slice(0, 48_000),
    snapshot.image.slice(48_000),
  ];
}

/** 스냅샷은 원문 전체가 아닌 검토된 카드 필드만 보존한다. */
export function snapshotFromRow(row: readonly string[]): Snapshot {
  if (row.length !== SNAPSHOT_HEADERS.length) throw new Error("게시본 열 구성이 다릅니다.");
  return {
    id: identifier(row[0]),
    articleId: identifier(row[1]),
    title: title(row[2], true),
    url: normalizeNewsUrl(row[3]),
    firstPublishedAt: timestamp(row[4]!),
    savedAt: timestamp(row[5]!),
    image: checkedImage(row[6]! + row[7]!),
  };
}

/** 현재 게시 참조만 투영한다. 미완료 스냅샷·초안·숨김·관리 필드는 공개하지 않는다. */
export function publicFeed(
  records: readonly NewsRecord[],
  snapshots: readonly Snapshot[],
): { articles: PublicCard[] } {
  const index = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return {
    articles: records
      .filter((record) => record.status === "게시")
      .sort(
        (a, b) => b.firstPublishedAt.localeCompare(a.firstPublishedAt) || b.id.localeCompare(a.id),
      )
      .slice(0, 3)
      .map((record) => {
        const snapshot = index.get(record.snapshotId);
        if (
          !snapshot ||
          snapshot.articleId !== record.id ||
          snapshot.firstPublishedAt !== record.firstPublishedAt
        )
          throw new Error("게시본 참조를 확인해 주세요.");
        return {
          id: record.id,
          title: snapshot.title,
          url: snapshot.url,
          imageUrl: snapshot.image ? "data:image/jpeg;base64," + snapshot.image : null,
        };
      }),
  };
}
