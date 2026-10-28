import {
  applyCandidate,
  assertUnique,
  createRecord,
  editRecord,
  hideRecord,
  preparePublication,
  publicFeed,
  normalizeNewsUrl,
  type NewsRecord,
  type Snapshot,
} from "./model";

/** Google 전역과 외부 I/O를 격리한다. 테스트는 메모리 저장소를 명시적으로 주입한다. */
export type NewsPort = {
  authorize: () => void;
  lock: <T>(work: () => T) => T;
  records: () => NewsRecord[];
  snapshots: () => Snapshot[];
  write: (record: NewsRecord, creating?: boolean) => void;
  appendSnapshot: (snapshot: Snapshot) => void;
  extract: (url: string, imageOnly: boolean) => unknown;
  etag: (record: NewsRecord) => string;
  uuid: () => string;
  now: () => string;
};

/** 클라이언트는 원문 저장 행이나 셀 주소를 지정할 수 없다. */
export type NewsCommand = {
  action: "create" | "fetch" | "save" | "publish" | "hide";
  id?: string;
  etag?: string;
  url?: string;
  title?: string;
  imageChoice?: string;
};

/** 동시 편집·후보 적용·게시 참조 전환 순서를 관리한다. I/O 실패는 성공으로 반환하지 않는다. */
export function newsService(port: NewsPort) {
  function current(command: NewsCommand) {
    const records = port.records();
    const record = records.find((entry) => entry.id === command.id);
    if (!record || port.etag(record) !== command.etag)
      throw new Error("다른 편집이 반영됐습니다. 목록을 새로 불러온 뒤 다시 시도해 주세요.");
    return { record, records };
  }
  return {
    list() {
      port.authorize();
      return port.lock(() =>
        port.records().map((record) => ({ ...record, etag: port.etag(record) })),
      );
    },
    execute(command: NewsCommand) {
      port.authorize();
      if (!["create", "fetch", "save", "publish", "hide"].includes(command.action))
        throw new Error("지원하지 않는 뉴스 작업입니다.");
      if (command.action === "fetch") {
        const initial = port.lock(() => current(command).record);
        const imageOnly = command.url !== undefined;
        const candidate = port.extract(normalizeNewsUrl(command.url ?? initial.url), imageOnly);
        // 느린 외부 I/O 중 잠금을 점유하지 않고, 다시 잠근 뒤 버전을 재검증한다.
        port.authorize();
        return port.lock(() => {
          const { record, records } = current(command);
          const next = applyCandidate(record, candidate, port.now(), imageOnly);
          if (!imageOnly) assertUnique(records, next.resolvedUrl, record.id);
          port.write(next);
          return { ...next, etag: port.etag(next) };
        });
      }
      return port.lock(() => {
        if (command.action === "create") {
          const record = createRecord(port.uuid(), command.url, port.now());
          assertUnique(port.records(), record.url);
          port.write(record, true);
          return { ...record, etag: port.etag(record) };
        }
        const { record } = current(command);
        let next: NewsRecord;
        if (command.action === "save") {
          next = editRecord(record, command.title, command.imageChoice, port.now());
        } else if (command.action === "hide") {
          next = hideRecord(record, port.now());
        } else {
          const publication = preparePublication(record, port.uuid(), port.now());
          // 게시본 저장 실패면 관리 행은 바꾸지 않는다. 마지막 참조 변경 실패면 고아 게시본만 남는다.
          port.appendSnapshot(publication.snapshot);
          next = publication.record;
        }
        port.write(next);
        return { ...next, etag: port.etag(next) };
      });
    },
    feed() {
      return port.lock(() => publicFeed(port.records(), port.snapshots()));
    },
  };
}
