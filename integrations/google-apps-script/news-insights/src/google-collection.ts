import { newsCollection, type CollectionJob, type CollectionStore } from "./collection";
import { googleNewsPort } from "./google";
import { authenticateWorker, rememberWorkerNonce } from "./worker-auth";

const PREFIX = "NEWS_COLLECTION_JOB_";

/** 설정을 명시하기 전에는 기존 HTTPS 수집 방식을 유지한다. */
export function isQueuedCollection() {
  return (
    PropertiesService.getScriptProperties().getProperty("NEWS_COLLECTION_MODE") === "github-actions"
  );
}

function store(): CollectionStore {
  const properties = PropertiesService.getScriptProperties();
  return {
    jobs: () =>
      Object.entries(properties.getProperties())
        .filter(([key]) => key.startsWith(PREFIX))
        .map(([, raw]) => JSON.parse(raw) as CollectionJob),
    put: (job) => {
      if (!/^[0-9a-f-]{36}$/u.test(job.articleId)) throw new Error("INVALID_JOB");
      const serialized = JSON.stringify(job);
      if (serialized.length > 5000) throw new Error("INVALID_JOB");
      properties.setProperty(PREFIX + job.articleId, serialized);
    },
    now: () => Date.now(),
  };
}

/** 뉴스 후보용 큐만 구성한다. 견적·상담과 공개 읽기 프로젝트는 참조하지 않는다. */
export function googleNewsCollection() {
  return newsCollection(googleNewsPort(), store());
}

/** 서명된 수집 작업자는 대기 URL 수신과 후보 반환만 가능하며 게시 RPC를 호출할 수 없다. */
export function handleNewsWorker(raw: string) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const token = properties.getProperty("NEWS_WORKER_TOKEN") ?? "";
    if (!isQueuedCollection() || !/^[a-f0-9]{64}$/u.test(token)) throw new Error("UNAVAILABLE");
    const input = authenticateWorker(raw, {
      now: () => Date.now(),
      hmac: (payload) =>
        Utilities.computeHmacSha256Signature(payload, token, Utilities.Charset.UTF_8)
          .map((byte) => (byte & 255).toString(16).padStart(2, "0"))
          .join(""),
      consumeNonce: (nonce, now) => {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(5000)) throw new Error("BUSY");
        try {
          properties.setProperty(
            "NEWS_WORKER_NONCES",
            rememberWorkerNonce(properties.getProperty("NEWS_WORKER_NONCES") ?? "[]", nonce, now),
          );
        } finally {
          lock.releaseLock();
        }
      },
    });
    const collection = googleNewsCollection();
    return {
      ok: true,
      data:
        input.action === "probe"
          ? { pending: collection.hasPending() }
          : input.action === "claim"
            ? collection.claim()
            : collection.complete({
                jobId: input.body.jobId as string,
                lease: input.body.lease as string,
                ...(input.body.failed === true
                  ? { failed: true }
                  : { candidate: input.body.candidate }),
              }),
    };
  } catch {
    // 공개 HTTP 오류에는 문서 식별자·계정·비밀·원문·내부 예외를 내보내지 않는다.
    return { ok: false, error: "NEWS_WORKER_UNAVAILABLE" };
  }
}
