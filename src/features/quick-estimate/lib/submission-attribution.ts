/** 출처는 분류 metadata이며 인증·정산·제한 우회에 사용하지 않습니다. */
export type SubmissionAttribution = {
  channel: "homepage" | "embed" | "hosted";
  siteOrigin: string | null;
  collectionMethod: "parent_message" | "referrer" | "self_location" | "configured" | "unknown";
};

/** HTTPS DNS 외의 설치 환경과 홈페이지 origin을 서버 소유 설정으로 제한합니다. */
export type AttributionPolicy = {
  allowedOrigins?: readonly string[];
  homepageOrigins?: readonly string[];
};

/** URL 전역이 없는 Apps Script에서도 같은 ASCII origin 문법으로 정규화합니다. */
export function normalizeSiteOrigin(
  value: unknown,
  allowedOrigins: readonly string[] = [],
): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  const match = /^(https?):\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?$/iu.exec(value);
  if (!match) return null;
  const scheme = match[1]?.toLowerCase();
  const host = match[2]?.toLowerCase().replace(/\.$/u, "");
  if (
    !host ||
    host.length > 253 ||
    host.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  )
    return null;
  const port = match[3] ? Number(match[3]) : null;
  if (port !== null && (port < 1 || port > 65535)) return null;
  const nonDefaultPort = port !== null && port !== (scheme === "https" ? 443 : 80);
  const origin = `${scheme}://${host}${nonDefaultPort ? `:${port}` : ""}`;
  const standard =
    scheme === "https" &&
    !nonDefaultPort &&
    host.includes(".") &&
    !/^[\d.]+$/u.test(host) &&
    host !== "localhost";
  return standard || allowedOrigins.includes(origin) ? origin : null;
}

/** 부분 누락·알 수 없는 키·출처 수집 방법의 모순을 거절합니다. */
export function parseSubmissionAttribution(
  value: unknown,
  policy: AttributionPolicy = {},
): SubmissionAttribution | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 3 ||
    !["channel", "siteOrigin", "collectionMethod"].every((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    )
  )
    return null;
  const channel = input.channel;
  const method = input.collectionMethod;
  if (channel !== "homepage" && channel !== "embed" && channel !== "hosted") return null;
  if (method === "unknown")
    return input.siteOrigin === null
      ? { channel, siteOrigin: null, collectionMethod: method }
      : null;
  if (!(
    (channel === "homepage" && method === "self_location") ||
    (channel === "embed" && (method === "parent_message" || method === "referrer")) ||
    (channel === "hosted" && method === "configured")
  ))
    return null;
  const origin = normalizeSiteOrigin(input.siteOrigin, policy.allowedOrigins);
  if (!origin || (channel === "homepage" && !policy.homepageOrigins?.includes(origin))) return null;
  return { channel, siteOrigin: origin, collectionMethod: method };
}

/** 브라우저 관측 URL에서 path·query·hash를 버리고 수집 실패를 명시합니다. */
export function observeAttribution(
  channel: SubmissionAttribution["channel"],
  method: SubmissionAttribution["collectionMethod"],
  value: string,
  policy: AttributionPolicy = {},
): SubmissionAttribution {
  try {
    const url = new URL(value);
    if (url.username || url.password) throw new Error("credentials_in_origin");
    const attribution = parseSubmissionAttribution(
      { channel, collectionMethod: method, siteOrigin: url.origin },
      policy,
    );
    if (attribution) return attribution;
  } catch {
    /* 획득 실패는 홈페이지로 추정하지 않습니다. */
  }
  return { channel, siteOrigin: null, collectionMethod: "unknown" };
}
