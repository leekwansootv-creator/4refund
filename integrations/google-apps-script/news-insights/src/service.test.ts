import { describe, expect, it, vi } from "vitest";
import {
  applyCandidate,
  createRecord,
  editRecord,
  normalizeNewsUrl,
  publicFeed,
  recordFromRow,
  recordToRow,
  snapshotFromRow,
  snapshotToRow,
  type NewsRecord,
  type Snapshot,
} from "./model";
import { newsService, type NewsPort } from "./service";

const id = "00000000-0000-4000-8000-000000000001";
const now = "2026-10-27T00:00:00.000Z";
const candidate = {
  url: "https://news.example.org/article",
  title: "가져온 제목",
  image: null,
  warning: "IMAGE_MISSING",
  fingerprint: "a".repeat(64),
};
function fixture() {
  let records: NewsRecord[] = [],
    snapshots: Snapshot[] = [],
    number = 0;
  const port: NewsPort = {
    authorize: vi.fn(),
    lock: (work) => work(),
    records: () => structuredClone(records),
    snapshots: () => structuredClone(snapshots),
    write: vi.fn((record, creating = false) => {
      records = creating
        ? [...records, record]
        : records.map((old) => (old.id === record.id ? record : old));
    }),
    appendSnapshot: vi.fn((snapshot) => {
      snapshots.push(snapshot);
    }),
    extract: vi.fn(() => candidate),
    etag: (record) => JSON.stringify(record),
    uuid: () => "00000000-0000-4000-8000-" + String(++number).padStart(12, "0"),
    now: () => now,
  };
  const service = newsService(port);
  function create(url = candidate.url) {
    return service.execute({ action: "create", url });
  }
  return {
    port,
    service,
    create,
    replace: (value: NewsRecord[]) => {
      records = value;
    },
    replaceSnapshots: (value: Snapshot[]) => {
      snapshots = value;
    },
  };
}

describe("뉴스 편집·게시 계약", () => {
  it("재수집은 수동 제목과 이미지를 덮지 않고 변경 경고를 남긴다", () => {
    const base = editRecord(createRecord(id, candidate.url, now), "수동 제목", "keep", now);
    const first = applyCandidate(base, candidate, now);
    const next = applyCandidate(
      first,
      { ...candidate, title: "바뀐 제목", warning: null, fingerprint: "b".repeat(64) },
      now,
    );
    expect(next.title).toBe("수동 제목");
    expect(next.candidateTitle).toBe("바뀐 제목");
    expect(next.warning).toBe("SOURCE_CHANGED");
  });
  it("초안 → 게시 → 편집 → 숨김 → 재게시에서 최초 게시일과 스냅샷 경계를 지킨다", () => {
    const { service, create, port } = fixture();
    let record = create();
    expect(service.feed()).toEqual({ articles: [] });
    record = service.execute({
      action: "save",
      id: record.id,
      etag: record.etag,
      title: "처음 제목",
      imageChoice: "keep",
    });
    record = service.execute({ action: "publish", id: record.id, etag: record.etag });
    expect(service.feed().articles[0]?.title).toBe("처음 제목");
    record = service.execute({
      action: "save",
      id: record.id,
      etag: record.etag,
      title: "수정 제목",
      imageChoice: "remove",
    });
    expect(service.feed().articles[0]?.title).toBe("처음 제목");
    record = service.execute({ action: "hide", id: record.id, etag: record.etag });
    expect(service.feed().articles).toEqual([]);
    port.now = () => "2026-10-28T00:00:00.000Z";
    record = service.execute({ action: "publish", id: record.id, etag: record.etag });
    expect(record.firstPublishedAt).toBe(now);
    expect(service.feed().articles[0]).toEqual({
      id: record.id,
      title: "수정 제목",
      url: candidate.url,
      imageUrl: null,
    });
  });
  it("권한 실패는 목록·저장·수집 실행 전에 거절한다", () => {
    const { port, service } = fixture();
    port.authorize = () => {
      throw new Error("권한 없음");
    };
    expect(() => service.list()).toThrow("권한 없음");
    expect(() => service.execute({ action: "create", url: candidate.url })).toThrow("권한 없음");
    expect(port.write).not.toHaveBeenCalled();
    expect(port.extract).not.toHaveBeenCalled();
  });
  it("정규화 URL과 최종 URL의 중복 기사를 거절한다", () => {
    const { service, create } = fixture();
    const record = create("https://news.example.org/alias");
    service.execute({ action: "fetch", id: record.id, etag: record.etag });
    expect(() => create(candidate.url + "#top")).toThrow("이미 등록");
  });
  it("외부 수집 중 다른 편집이 생기면 후보도 덮어쓰지 않는다", () => {
    const { port, service, create, replace } = fixture();
    const record = create();
    port.extract = () => {
      replace([{ ...record, title: "다른 편집자" }]);
      return candidate;
    };
    expect(() => service.execute({ action: "fetch", id: record.id, etag: record.etag })).toThrow(
      "다른 편집",
    );
    expect(service.list()[0]?.title).toBe("다른 편집자");
    expect(service.list()[0]?.candidateTitle).toBe("");
  });
  it.each(["snapshot", "pointer"])("%s 저장 실패는 기존 게시본을 유지한다", (failure) => {
    const { port, service, create } = fixture();
    let record = create();
    record = service.execute({
      action: "save",
      id: record.id,
      etag: record.etag,
      title: "기존",
      imageChoice: "keep",
    });
    record = service.execute({ action: "publish", id: record.id, etag: record.etag });
    record = service.execute({
      action: "save",
      id: record.id,
      etag: record.etag,
      title: "새 제목",
      imageChoice: "keep",
    });
    if (failure === "snapshot")
      port.appendSnapshot = () => {
        throw new Error("저장 실패");
      };
    else
      port.write = () => {
        throw new Error("저장 실패");
      };
    expect(() => service.execute({ action: "publish", id: record.id, etag: record.etag })).toThrow(
      "저장 실패",
    );
    expect(service.feed().articles[0]?.title).toBe("기존");
  });
  it("빈 제목 게시와 손상된 공개 참조는 실패로 구분한다", () => {
    const { service, create, replaceSnapshots } = fixture();
    let record = create();
    expect(() => service.execute({ action: "publish", id: record.id, etag: record.etag })).toThrow(
      "제목",
    );
    record = service.execute({
      action: "save",
      id: record.id,
      etag: record.etag,
      title: "정상",
      imageChoice: "keep",
    });
    service.execute({ action: "publish", id: record.id, etag: record.etag });
    replaceSnapshots([]);
    expect(() => service.feed()).toThrow("게시본 참조");
  });
  it("최신 최초 게시 순 최대 3개와 공개 4필드만 반환한다", () => {
    const { service, create, port } = fixture();
    for (let i = 1; i <= 5; i++) {
      port.now = () => `2026-10-2${i}T00:00:00.000Z`;
      let record = create(candidate.url + i);
      record = service.execute({
        action: "save",
        id: record.id,
        etag: record.etag,
        title: `기사 ${i}`,
        imageChoice: "keep",
      });
      service.execute({ action: "publish", id: record.id, etag: record.etag });
    }
    const articles = service.feed().articles;
    expect(articles.map((article) => article.title)).toEqual(["기사 5", "기사 4", "기사 3"]);
    expect(Object.keys(articles[0]!).sort()).toEqual(["id", "imageUrl", "title", "url"]);
  });
});

describe("시트 경계 검증", () => {
  it.each([
    "https://good.org@evil.org/",
    "http://127.0.0.1/",
    "file:///x",
    "https://n.local/",
    "https://a.org:8080/",
    "https://a.org\\x",
  ])("%s 거절", (url) => {
    expect(() => normalizeNewsUrl(url)).toThrow();
  });
  it("긴 이미지 청크와 텍스트를 행으로 왕복하고 셀 한도를 지킨다", () => {
    const image = "/9j/" + "A".repeat(80_000);
    const record = {
      ...createRecord(id, candidate.url, now),
      title: "=IMPORTXML(외부 수식)",
      image,
    };
    expect(recordFromRow(recordToRow(record))).toEqual(record);
    expect(Math.max(...recordToRow(record).map((value) => value.length))).toBeLessThan(50_000);
    const snapshot = {
      id,
      articleId: id,
      title: "게시 제목",
      url: candidate.url,
      firstPublishedAt: now,
      savedAt: now,
      image,
    };
    expect(snapshotFromRow(snapshotToRow(snapshot))).toEqual(snapshot);
  });
  it("관리 필드가 섞인 수집 응답과 SVG 후보를 거절한다", () => {
    const record = createRecord(id, candidate.url, now);
    expect(() => applyCandidate(record, { ...candidate, secret: "private" }, now)).toThrow();
    expect(() =>
      applyCandidate(record, { ...candidate, image: "data:image/svg+xml;base64,AAA=" }, now),
    ).toThrow();
    expect(publicFeed([record], [])).toEqual({ articles: [] });
  });
});
