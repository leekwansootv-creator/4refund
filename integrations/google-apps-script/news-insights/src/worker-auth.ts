/** 작업자 서명 검증의 최소 경계. 비밀값은 응답·로그에 포함하지 않는다. */
export type WorkerAuthPort = {
  hmac: (payload: string) => string;
  now: () => number;
  consumeNonce: (nonce: string, now: number) => void;
};

/** 허용 시각 오차 양끝을 합친 10분 동안 nonce를 보존해 미래 시각 요청의 재사용도 막는다. */
export function rememberWorkerNonce(raw: string, nonce: string, now: number) {
  const entries: unknown = JSON.parse(raw);
  if (
    !Array.isArray(entries) ||
    entries.some(
      (entry) => !entry || typeof entry.nonce !== "string" || !Number.isSafeInteger(entry.at),
    )
  )
    throw new Error("INVALID_NONCES");
  const recent = entries.filter((entry) => now - entry.at <= 600_000);
  if (recent.length >= 60 || recent.some((entry) => entry.nonce === nonce))
    throw new Error("REPLAY");
  return JSON.stringify([...recent, { nonce, at: now }]);
}

/** HMAC·시각·재전송 검사를 통과하기 전에는 본문의 작업을 실행하지 않는다. */
export function authenticateWorker(raw: string, port: WorkerAuthPort) {
  if (raw.length > 120_000) throw new Error("INVALID_REQUEST");
  const envelope: unknown = JSON.parse(raw);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope))
    throw new Error("INVALID_REQUEST");
  const value = envelope as Record<string, unknown>;
  if (
    Object.keys(value).sort().join() !== "payload,signature" ||
    typeof value.payload !== "string" ||
    typeof value.signature !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.signature)
  )
    throw new Error("INVALID_REQUEST");
  const expected = port.hmac(value.payload);
  let different = expected.length ^ value.signature.length;
  for (let index = 0; index < 64; index++)
    different |= expected.charCodeAt(index) ^ value.signature.charCodeAt(index);
  if (different) throw new Error("UNAUTHORIZED");
  const message: unknown = JSON.parse(value.payload);
  if (!message || typeof message !== "object" || Array.isArray(message))
    throw new Error("INVALID_REQUEST");
  const input = message as Record<string, unknown>;
  const now = port.now();
  if (
    Object.keys(input).sort().join() !== "action,body,nonce,timestamp,version" ||
    input.version !== 1 ||
    !["probe", "claim", "complete"].includes(String(input.action)) ||
    typeof input.nonce !== "string" ||
    !/^[0-9a-f-]{36}$/u.test(input.nonce) ||
    typeof input.timestamp !== "number" ||
    !Number.isSafeInteger(input.timestamp) ||
    Math.abs(now - input.timestamp) > 300_000 ||
    !input.body ||
    typeof input.body !== "object" ||
    Array.isArray(input.body)
  )
    throw new Error("INVALID_REQUEST");
  const body = input.body as Record<string, unknown>;
  if (input.action !== "complete" && Object.keys(body).length) throw new Error("INVALID_REQUEST");
  if (
    input.action === "complete" &&
    (typeof body.jobId !== "string" ||
      typeof body.lease !== "string" ||
      Object.keys(body).sort().join() !==
        (body.failed === true ? "failed,jobId,lease" : "candidate,jobId,lease"))
  )
    throw new Error("INVALID_REQUEST");
  port.consumeNonce(input.nonce, now);
  return { action: input.action, body };
}
