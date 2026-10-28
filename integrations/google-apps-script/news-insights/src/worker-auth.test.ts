import { createHmac } from "node:crypto";
import { expect, it, vi } from "vitest";
import { authenticateWorker, rememberWorkerNonce } from "./worker-auth";

const key = "a".repeat(64),
  now = 1000000;
const sign = (payload: string) => createHmac("sha256", key).update(payload).digest("hex");
const message = {
  version: 1,
  action: "claim",
  body: {},
  nonce: "00000000-0000-4000-8000-000000000001",
  timestamp: now,
};
function envelope(value: unknown) {
  const payload = JSON.stringify(value);
  return JSON.stringify({ payload, signature: sign(payload) });
}

it("정확한 서명과 유효한 작업만 허용하고 재전송 nonce를 소비한다", () => {
  const used = new Set<string>();
  const port = {
    hmac: sign,
    now: () => now,
    consumeNonce: (nonce: string) => {
      if (used.has(nonce)) throw new Error("REPLAY");
      used.add(nonce);
    },
  };
  expect(authenticateWorker(envelope(message), port)).toEqual({ action: "claim", body: {} });
  expect(() => authenticateWorker(envelope(message), port)).toThrow("REPLAY");
});

it.each([
  { ...message, action: "publish" },
  { ...message, timestamp: now - 300001 },
  { ...message, timestamp: now + 300001 },
  { ...message, body: { range: "leads!A1" } },
  { ...message, action: "complete", body: { jobId: "x", lease: "y", candidate: {}, failed: true } },
  { ...message, action: "complete", body: { jobId: "x", lease: "y", failed: false } },
])("금지된 작업·범위·시각·본문은 nonce 저장보다 먼저 거절한다", (value) => {
  const consumeNonce = vi.fn();
  expect(() =>
    authenticateWorker(envelope(value), { hmac: sign, now: () => now, consumeNonce }),
  ).toThrow();
  expect(consumeNonce).not.toHaveBeenCalled();
});

it("인증 실패와 과대 입력에서는 본문 작업·nonce 저장을 하지 않는다", () => {
  const consumeNonce = vi.fn(),
    port = { hmac: sign, now: () => now, consumeNonce };
  expect(() =>
    authenticateWorker(
      JSON.stringify({ payload: JSON.stringify(message), signature: "0".repeat(64) }),
      port,
    ),
  ).toThrow("UNAUTHORIZED");
  expect(() => authenticateWorker("x".repeat(120001), port)).toThrow("INVALID_REQUEST");
  expect(consumeNonce).not.toHaveBeenCalled();
});

it("5분 미래 시각으로 수신한 요청도 전체 유효 기간 동안 재사용을 차단한다", () => {
  let clock = now,
    saved = "[]";
  const port = {
    hmac: sign,
    now: () => clock,
    consumeNonce: (nonce: string, time: number) => {
      saved = rememberWorkerNonce(saved, nonce, time);
    },
  };
  const signed = envelope({ ...message, timestamp: now + 300_000 });
  authenticateWorker(signed, port);
  clock += 300_001;
  expect(() => authenticateWorker(signed, port)).toThrow("REPLAY");
  clock = now + 600_000;
  expect(() => authenticateWorker(signed, port)).toThrow("REPLAY");
  clock++;
  expect(() => authenticateWorker(signed, port)).toThrow("INVALID_REQUEST");
  expect(JSON.parse(rememberWorkerNonce(saved, "new", clock))).toHaveLength(1);
});

it("nonce 저장은 60건으로 제한하고 손상된 저장값은 닫힌 상태로 거절한다", () => {
  const entries = Array.from({ length: 60 }, (_, index) => ({ nonce: String(index), at: now }));
  expect(() => rememberWorkerNonce(JSON.stringify(entries), "new", now)).toThrow("REPLAY");
  expect(() => rememberWorkerNonce('[{"nonce":"x","at":"bad"}]', "new", now)).toThrow(
    "INVALID_NONCES",
  );
  expect(() => rememberWorkerNonce("{}", "new", now)).toThrow("INVALID_NONCES");
});
