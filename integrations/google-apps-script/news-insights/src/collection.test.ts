import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { newsCollection, type CollectionJob } from "./collection";
import { createRecord, editRecord, type NewsRecord } from "./model";
import type { NewsPort } from "./service";

const articleId = "00000000-0000-4000-8000-000000000001";
const date = "2026-10-28T00:00:00.000Z";
const candidate = {
  url: "https://news.example.org/article",
  title: "가져온 제목",
  image: null,
  warning: "IMAGE_MISSING",
  fingerprint: "a".repeat(64),
};

function fixture() {
  let now = Date.parse(date),
    number = 10;
  let record = editRecord(createRecord(articleId, candidate.url, date), "수동 제목", "keep", date);
  let jobs: CollectionJob[] = [];
  const port: NewsPort = {
    authorize: vi.fn(),
    lock: (work) => work(),
    records: () => [structuredClone(record)],
    snapshots: () => [],
    appendSnapshot: vi.fn(),
    extract: vi.fn(),
    write: vi.fn((next: NewsRecord) => {
      record = next;
    }),
    etag: (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    uuid: () => `00000000-0000-4000-8000-${String(++number).padStart(12, "0")}`,
    now: () => new Date(now).toISOString(),
  };
  const queue = newsCollection(port, {
    jobs: () => structuredClone(jobs),
    put: (job) => {
      jobs = jobs.filter((entry) => entry.articleId !== job.articleId).concat(job);
    },
    now: () => now,
  });
  return {
    port,
    queue,
    record: () => record,
    jobs: () => jobs,
    enqueue: () => queue.enqueue({ action: "fetch", id: articleId, etag: port.etag(record) }),
    advance: (ms: number) => {
      now += ms;
    },
    edit: () => {
      record = editRecord(record, "수집 중 바꾼 제목", "keep", date);
    },
  };
}

it("권한 검사 후 큐에만 넣고 중복 클릭은 하나의 작업으로 유지한다", () => {
  const f = fixture();
  const first = f.enqueue();
  f.enqueue();
  expect(f.port.authorize).toHaveBeenCalledTimes(2);
  expect(f.jobs()).toHaveLength(1);
  expect(first.collection?.status).toBe("queued");
  expect(f.port.write).not.toHaveBeenCalled();
  expect(f.port.extract).not.toHaveBeenCalled();
  expect(f.queue.status(articleId)).toEqual({ status: "queued" });
  f.port.authorize = () => {
    throw new Error("denied");
  };
  expect(f.enqueue).toThrow("denied");
});

it("작업자는 최소 작업 정보만 받고 결과는 후보만 변경하며 재전송은 멱등하다", () => {
  const f = fixture();
  f.enqueue();
  const job = f.queue.claim()!;
  expect(Object.keys(job).sort()).toEqual(["imageOnly", "jobId", "lease", "url"]);
  expect(f.queue.claim()).toBeNull();
  f.queue.complete({ ...job, candidate });
  expect(f.record().title).toBe("수동 제목");
  expect(f.record().candidateTitle).toBe("가져온 제목");
  expect(f.record().status).toBe("초안");
  expect(f.port.appendSnapshot).not.toHaveBeenCalled();
  expect(f.queue.complete({ ...job, candidate })).toEqual({ accepted: true, duplicate: true });
  expect(f.port.write).toHaveBeenCalledTimes(1);
  expect(f.queue.status(articleId).record?.collection?.status).toBe("succeeded");
});

it("수집 중 편집되면 늦은 후보는 버리고 수동 수정값을 유지한다", () => {
  const f = fixture();
  f.enqueue();
  const job = f.queue.claim()!;
  f.edit();
  f.queue.complete({ ...job, candidate });
  expect(f.record().title).toBe("수집 중 바꾼 제목");
  expect(f.record().candidateTitle).toBe("");
  expect(f.jobs()[0]?.status).toBe("conflict");
});

it("다른 lease, 만료 결과, 잘못된 이미지, 수집 실패는 게시와 편집값을 바꾸지 않는다", () => {
  const f = fixture();
  f.enqueue();
  const job = f.queue.claim()!;
  expect(() => f.queue.complete({ ...job, lease: "wrong", candidate })).toThrow("INVALID_JOB");
  f.advance(180001);
  expect(() => f.queue.complete({ ...job, candidate })).toThrow("EXPIRED_JOB");
  const next = f.queue.claim()!;
  expect(next.lease).not.toBe(job.lease);
  f.queue.complete({ ...next, candidate: { ...candidate, image: "javascript:bad" } });
  expect(f.jobs()[0]?.status).toBe("failed");
  expect(f.port.write).not.toHaveBeenCalled();
  f.enqueue();
  const again = f.queue.claim()!;
  f.queue.complete({ ...again, failed: true });
  expect(f.jobs()[0]?.status).toBe("failed");
});

it("작업자 중단은 최대 두 번 임대하고 한 시간 지난 큐는 실패로 전환한다", () => {
  const f = fixture();
  f.enqueue();
  f.queue.claim();
  f.advance(180001);
  f.queue.claim();
  f.advance(180001);
  expect(f.queue.claim()).toBeNull();
  expect(f.jobs()[0]?.status).toBe("failed");
  f.enqueue();
  f.advance(3_600_001);
  const expired = f.queue.status(articleId);
  expect(expired.status).toBe("failed");
  expect(expired.record?.collection?.status).toBe("failed");
});
