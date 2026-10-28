import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { handleNewsWorker } from "./google-collection";

afterEach(() => vi.unstubAllGlobals());

function workerFixture() {
  const token = "a".repeat(64);
  const properties: Record<string, string> = {
    NEWS_COLLECTION_MODE: "github-actions",
    NEWS_WORKER_TOKEN: token,
  };
  const readSheet = vi.fn(() => {
    throw new Error("unexpected sheet access");
  });
  const writeProperty = vi.fn((key: string, value: string) => {
    properties[key] = value;
  });
  vi.stubGlobal("PropertiesService", {
    getScriptProperties: () => ({
      getProperty: (key: string) => properties[key] ?? null,
      getProperties: () => ({ ...properties }),
      setProperty: writeProperty,
    }),
  });
  vi.stubGlobal("Utilities", {
    Charset: { UTF_8: "UTF_8" },
    computeHmacSha256Signature: (payload: string, secret: string) => [
      ...createHmac("sha256", secret).update(payload).digest(),
    ],
  });
  vi.stubGlobal("SpreadsheetApp", { openById: readSheet });
  vi.stubGlobal("LockService", {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: vi.fn() }),
  });
  const request = (action: string, body = {}) => {
    const payload = JSON.stringify({
      version: 1,
      action,
      body,
      timestamp: Date.now(),
      nonce: "00000000-0000-4000-8000-000000000001",
    });
    return JSON.stringify({
      payload,
      signature: createHmac("sha256", token).update(payload).digest("hex"),
    });
  };
  return { properties, readSheet, writeProperty, request };
}

it("미인증·금지된 게시 요청은 Sheet와 큐를 건드리지 않고 고정 오류만 반환한다", () => {
  const f = workerFixture();
  const error = { ok: false, error: "NEWS_WORKER_UNAVAILABLE" };
  expect(handleNewsWorker("private invalid input")).toEqual(error);
  expect(handleNewsWorker(f.request("publish"))).toEqual(error);
  expect(handleNewsWorker(f.request("probe", { range: "leads!A1" }))).toEqual(error);
  expect(f.readSheet).not.toHaveBeenCalled();
  expect(f.writeProperty).not.toHaveBeenCalled();
});

it("서명된 상태 확인은 Boolean만 반환하고 같은 요청 재전송은 거절한다", () => {
  const f = workerFixture();
  const request = f.request("probe");
  expect(handleNewsWorker(request)).toEqual({ ok: true, data: { pending: false } });
  expect(handleNewsWorker(request)).toEqual({ ok: false, error: "NEWS_WORKER_UNAVAILABLE" });
  expect(f.readSheet).not.toHaveBeenCalled();
  expect(Object.keys(f.properties)).toContain("NEWS_WORKER_NONCES");
});

it("명시적 대기열 설정이 없으면 유효한 서명으로도 활성화되지 않는다", () => {
  const f = workerFixture();
  delete f.properties.NEWS_COLLECTION_MODE;
  expect(handleNewsWorker(f.request("claim"))).toEqual({
    ok: false,
    error: "NEWS_WORKER_UNAVAILABLE",
  });
  expect(f.writeProperty).not.toHaveBeenCalled();
});
