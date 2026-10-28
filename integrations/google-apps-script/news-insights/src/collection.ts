import { applyCandidate, assertUnique, normalizeNewsUrl, type NewsRecord } from "./model";
import type { NewsCommand, NewsPort } from "./service";

/** 수집 결과는 후보만 바꾼다. 편집값·게시본·최초 게시일은 작업 큐에 포함하지 않는다. */
export type CollectionJob = {
  id: string;
  articleId: string;
  etag: string;
  url: string;
  imageOnly: boolean;
  status: "queued" | "running" | "succeeded" | "failed" | "conflict";
  queuedAt: number;
  lease: string;
  leaseUntil: number;
  attempts: number;
};

/** 큐는 관리 프로젝트의 비공개 속성에 보관하며 공개 뉴스 응답과 분리한다. */
export type CollectionStore = {
  jobs: () => CollectionJob[];
  put: (job: CollectionJob) => void;
  now: () => number;
};

const pending = (job: CollectionJob) => job.status === "queued" || job.status === "running";

/** 인증된 편집 요청과 서명 검증을 통과한 작업자 요청에 서로 다른 최소 동작을 제공한다. */
export function newsCollection(news: NewsPort, store: CollectionStore) {
  function view(record: NewsRecord) {
    const job = store.jobs().find((entry) => entry.articleId === record.id);
    return {
      ...record,
      etag: news.etag(record),
      collection: job ? { status: job.status, queuedAt: job.queuedAt } : null,
    };
  }
  return {
    view,
    hasPending: () => store.jobs().some(pending),
    status(id: string) {
      news.authorize();
      return news.lock(() => {
        const job = store.jobs().find((entry) => entry.articleId === id);
        if (!job) return { status: "none" };
        if (pending(job) && store.now() - job.queuedAt < 3_600_000) return { status: job.status };
        const status = pending(job) ? "failed" : job.status;
        if (pending(job)) store.put({ ...job, status });
        const record = news.records().find((entry) => entry.id === id);
        if (!record) throw new Error("INVALID_JOB");
        return { status, record: view(record) };
      });
    },
    enqueue(command: NewsCommand) {
      news.authorize();
      return news.lock(() => {
        const record = news.records().find((entry) => entry.id === command.id);
        if (!record || news.etag(record) !== command.etag)
          throw new Error("다른 편집이 반영됐습니다. 목록을 새로 불러온 뒤 다시 시도해 주세요.");
        const old = store.jobs().find((job) => job.articleId === record.id);
        if (old && pending(old) && store.now() - old.queuedAt < 3_600_000) return view(record);
        store.put({
          id: news.uuid(),
          articleId: record.id,
          etag: news.etag(record),
          url: normalizeNewsUrl(command.url ?? record.url),
          imageOnly: command.url !== undefined,
          status: "queued",
          queuedAt: store.now(),
          lease: "",
          leaseUntil: 0,
          attempts: 0,
        });
        return view(record);
      });
    },
    claim() {
      return news.lock(() => {
        const now = store.now();
        const jobs = store
          .jobs()
          .filter(pending)
          .sort((a, b) => a.queuedAt - b.queuedAt);
        for (const job of jobs) {
          if (job.status === "running" && job.leaseUntil > now) continue;
          if (job.attempts >= 2 || now - job.queuedAt >= 3_600_000) {
            store.put({ ...job, status: "failed" });
            continue;
          }
          const next: CollectionJob = {
            ...job,
            status: "running",
            lease: news.uuid(),
            leaseUntil: now + 180_000,
            attempts: job.attempts + 1,
          };
          store.put(next);
          return { jobId: next.id, lease: next.lease, url: next.url, imageOnly: next.imageOnly };
        }
        return null;
      });
    },
    complete(input: { jobId: string; lease: string; candidate?: unknown; failed?: boolean }) {
      return news.lock(() => {
        const job = store.jobs().find((entry) => entry.id === input.jobId);
        if (!job || job.lease !== input.lease || !job.lease) throw new Error("INVALID_JOB");
        // 결과 응답 손실에 대한 재전송은 후보·버전·게시본을 두 번 바꾸지 않는다.
        if (!pending(job)) return { accepted: true, duplicate: true };
        if (job.status !== "running" || job.leaseUntil <= store.now())
          throw new Error("EXPIRED_JOB");
        if (input.failed) {
          store.put({ ...job, status: "failed" });
          return { accepted: true };
        }
        const records = news.records();
        const record = records.find((entry) => entry.id === job.articleId);
        if (!record || news.etag(record) !== job.etag) {
          store.put({ ...job, status: "conflict" });
          return { accepted: true };
        }
        try {
          const next = applyCandidate(record, input.candidate, news.now(), job.imageOnly);
          if (!job.imageOnly) assertUnique(records, next.resolvedUrl, record.id);
          news.write(next);
          store.put({ ...job, status: "succeeded" });
        } catch {
          store.put({ ...job, status: "failed" });
          return { accepted: true };
        }
        return { accepted: true };
      });
    },
  };
}
