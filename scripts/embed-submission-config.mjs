import { createHash } from "node:crypto";

const endpointPattern = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/u;

/** 빌드에 고정하는 공개 접수 주소의 종류와 해시만 archive에 기록합니다. */
export function describeEmbedSubmission(value = "") {
  const endpoint = value.trim();
  if (!endpointPattern.test(endpoint)) return { mode: "disabled", endpointDigest: null };
  return {
    mode: endpoint.includes("E2E-INTERCEPT-ONLY") ? "test" : "enabled",
    endpointDigest: createHash("sha256").update(endpoint).digest("hex"),
  };
}

/** 과거 archive는 로컬에서 보존하되 공개 시 접수 설정과 현재 승인된 주소를 대조합니다. */
export function verifyEmbedSubmission(
  configuration,
  { production = false, expectedEndpoint } = {},
) {
  // 출시 준비 이전 로컬 archive는 설정 증거가 없으므로 공개용으로 승격하지 않습니다.
  if (configuration === undefined && !production) return;
  if (
    !configuration ||
    !["disabled", "test", "enabled"].includes(configuration.mode) ||
    (configuration.mode === "disabled"
      ? configuration.endpointDigest !== null
      : !/^[a-f0-9]{64}$/u.test(configuration.endpointDigest))
  )
    throw new Error("submission_not_publishable");
  if (production && configuration.mode !== "enabled") throw new Error("submission_not_publishable");
  if (expectedEndpoint !== undefined) {
    const expected = describeEmbedSubmission(expectedEndpoint);
    if (expected.mode !== "enabled") throw new Error("production_endpoint_required");
    if (configuration.endpointDigest !== expected.endpointDigest)
      throw new Error("submission_endpoint_mismatch");
  }
}
