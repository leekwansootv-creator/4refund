import type {
  QuickEstimateSubmissionPayload,
  QuickEstimateSubmissionServerErrorCode,
  QuickEstimateSubmissionTransportResult,
  QuickEstimateSubmissionValidationErrorCode,
} from "../types/lead-submission";

/** Apps Script cold start를 포함해 응답을 기다리는 기본 제한 시간입니다. */
export const DEFAULT_SUBMISSION_TIMEOUT_MS = 15_000;

/** 브라우저 fetch를 테스트에서 대체할 수 있게 고정한 전송 port입니다. */
export type EstimateLeadFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** endpoint와 timeout을 호출 지점에서 주입하는 상담 제출 옵션입니다. */
export type SubmitEstimateLeadOptions = {
  endpoint: string;
  timeoutMs?: number;
  fetcher?: EstimateLeadFetch;
};

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const VALIDATION_ERROR_CODES = new Set<QuickEstimateSubmissionValidationErrorCode>([
  "INVALID_INPUT",
  "INVALID_CONSENT",
  "UNSUPPORTED_RULE",
]);
const SERVER_ERROR_CODES = new Set<QuickEstimateSubmissionServerErrorCode>([
  "STORAGE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: UnknownRecord, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  );
}

function parseSubmissionResponse(value: unknown): QuickEstimateSubmissionTransportResult | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return null;
  }

  if (value.ok) {
    if (
      !hasExactKeys(value, ["ok", "leadId", "duplicate"]) ||
      typeof value.leadId !== "string" ||
      !UUID_V4_PATTERN.test(value.leadId) ||
      typeof value.duplicate !== "boolean"
    ) {
      return null;
    }

    return {
      ok: true,
      leadId: value.leadId,
      duplicate: value.duplicate,
    };
  }

  if (!hasExactKeys(value, ["ok", "code"]) || typeof value.code !== "string") {
    return null;
  }

  if (VALIDATION_ERROR_CODES.has(value.code as QuickEstimateSubmissionValidationErrorCode)) {
    return {
      ok: false,
      kind: "validation",
      code: value.code as QuickEstimateSubmissionValidationErrorCode,
    };
  }

  if (SERVER_ERROR_CODES.has(value.code as QuickEstimateSubmissionServerErrorCode)) {
    return {
      ok: false,
      kind: "server",
      code: value.code as QuickEstimateSubmissionServerErrorCode,
    };
  }

  return null;
}

/** form encoded payload를 전송하고 판독 가능한 JSON body만 확정 결과로 반환합니다. */
export async function submitEstimateLead(
  payload: QuickEstimateSubmissionPayload,
  options: SubmitEstimateLeadOptions,
): Promise<QuickEstimateSubmissionTransportResult> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SUBMISSION_TIMEOUT_MS;
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetcher(options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({
        payload: JSON.stringify(payload),
      }),
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal,
    });

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      return didTimeout
        ? { ok: false, kind: "timeout" }
        : { ok: false, kind: "unreadable_response" };
    }

    const result = parseSubmissionResponse(body);

    if (result === null || (!response.ok && result.ok)) {
      return { ok: false, kind: "unreadable_response" };
    }

    return result;
  } catch {
    return didTimeout ? { ok: false, kind: "timeout" } : { ok: false, kind: "network" };
  } finally {
    clearTimeout(timeoutId);
  }
}
