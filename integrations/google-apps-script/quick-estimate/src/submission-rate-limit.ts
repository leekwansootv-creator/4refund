import type { QuickEstimateSubmissionPayload } from "@/features/quick-estimate";

const GLOBAL_MINUTE_LIMIT = 10;
const GLOBAL_DAILY_LIMIT = 100;
const CONTACT_HOURLY_LIMIT = 3;

/** 측정 전의 호환 기본값이며 Google의 최대 처리 용량을 뜻하지 않습니다. */
export type SubmissionRateLimits = { minute: number; daily: number; contactHourly: number };

/** 서버 설정 누락·오류가 무제한 접수로 바뀌지 않도록 양의 정수만 허용합니다. */
export function parseSubmissionRateLimits(value: string | null): SubmissionRateLimits {
  const fallback = {
    minute: GLOBAL_MINUTE_LIMIT,
    daily: GLOBAL_DAILY_LIMIT,
    contactHourly: CONTACT_HOURLY_LIMIT,
  };
  if (!value) return fallback;
  try {
    const input: unknown = JSON.parse(value);
    if (typeof input !== "object" || input === null) return fallback;
    const record = input as Record<string, unknown>;
    if (
      Object.keys(record).length !== 3 ||
      !["minute", "daily", "contactHourly"].every(
        (key) => Number.isSafeInteger(record[key]) && Number(record[key]) > 0,
      )
    )
      return fallback;
    return {
      minute: Number(record.minute),
      daily: Number(record.daily),
      contactHourly: Number(record.contactHourly),
    };
  } catch {
    return fallback;
  }
}
const MINUTE_CACHE_TTL_SECONDS = 120;
const CONTACT_CACHE_TTL_SECONDS = 7_200;
const SEEN_REQUEST_CACHE_TTL_SECONDS = 21_600;
const DAILY_STATE_PROPERTY = "QUICK_ESTIMATE_DAILY_RATE_LIMIT";
const LOCK_TIMEOUT_MILLISECONDS = 5_000;

type DailyRateLimitState = {
  date: string;
  count: number;
};

/** Apps Script service를 대체해 rate limit 정책을 단위 테스트할 수 있는 port입니다. */
export type SubmissionRateLimitPort = {
  withLock: <Result>(operation: () => Result) => Result;
  getCache: (key: string) => string | null;
  putCache: (key: string, value: string, expirationInSeconds: number) => void;
  getDailyState: () => string | null;
  setDailyState: (value: string) => void;
  hashContact: (value: string) => string;
};

/** 유효한 제출을 저장하기 전에 적용하는 고정 구간 rate limit 판정입니다. */
export type SubmissionRateLimitResult = { ok: true } | { ok: false; code: "RATE_LIMITED" };

function formatUtcMinute(now: Date): string {
  return now.toISOString().slice(0, 16);
}

function formatUtcHour(now: Date): string {
  return now.toISOString().slice(0, 13);
}

function formatUtcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function parseCounter(value: string | null): number {
  if (value === null) {
    return 0;
  }

  const count = Number(value);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("invalid_rate_limit_counter");
  }

  return count;
}

function parseDailyCount(value: string | null, currentDate: string): number {
  if (value === null) {
    return 0;
  }

  const parsed = JSON.parse(value) as unknown;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as DailyRateLimitState).date !== "string" ||
    !Number.isSafeInteger((parsed as DailyRateLimitState).count) ||
    (parsed as DailyRateLimitState).count < 0
  ) {
    throw new Error("invalid_daily_rate_limit_state");
  }

  const state = parsed as DailyRateLimitState;

  return state.date === currentDate ? state.count : 0;
}

/** request_id 재시도를 제외하고 분·일·연락처별 제출 횟수를 잠금 안에서 차감합니다. */
export function enforceSubmissionRateLimit(
  submission: QuickEstimateSubmissionPayload,
  dependencies: {
    port: SubmissionRateLimitPort;
    now: () => Date;
    limits?: SubmissionRateLimits;
  },
): SubmissionRateLimitResult {
  return dependencies.port.withLock(() => {
    const limits = parseSubmissionRateLimits(
      dependencies.limits ? JSON.stringify(dependencies.limits) : null,
    );
    const seenRequestKey = `quick-estimate:seen:${submission.requestId}`;

    if (dependencies.port.getCache(seenRequestKey) !== null) {
      return { ok: true };
    }

    const now = dependencies.now();
    const currentDate = formatUtcDate(now);
    const contactHash = dependencies.port.hashContact(
      `${submission.lead.email.toLowerCase()}\u0000${submission.lead.phone}`,
    );
    const minuteKey = `quick-estimate:minute:${formatUtcMinute(now)}`;
    const contactKey = `quick-estimate:contact:${formatUtcHour(now)}:${contactHash}`;
    const minuteCount = parseCounter(dependencies.port.getCache(minuteKey));
    const contactCount = parseCounter(dependencies.port.getCache(contactKey));
    const dailyCount = parseDailyCount(dependencies.port.getDailyState(), currentDate);

    if (
      minuteCount >= limits.minute ||
      dailyCount >= limits.daily ||
      contactCount >= limits.contactHourly
    ) {
      return { ok: false, code: "RATE_LIMITED" };
    }

    dependencies.port.putCache(minuteKey, String(minuteCount + 1), MINUTE_CACHE_TTL_SECONDS);
    dependencies.port.putCache(contactKey, String(contactCount + 1), CONTACT_CACHE_TTL_SECONDS);
    dependencies.port.setDailyState(
      JSON.stringify({ date: currentDate, count: dailyCount + 1 } satisfies DailyRateLimitState),
    );
    dependencies.port.putCache(seenRequestKey, "1", SEEN_REQUEST_CACHE_TTL_SECONDS);

    return { ok: true };
  });
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((byte) => ((byte + 256) % 256).toString(16).padStart(2, "0")).join("");
}

/** Apps Script Cache, Properties, Lock, Utilities에 연결한 rate limit port를 생성합니다. */
export function createRuntimeSubmissionRateLimitPort(): SubmissionRateLimitPort {
  const cache = CacheService.getScriptCache();
  const properties = PropertiesService.getScriptProperties();

  return {
    withLock: <Result>(operation: () => Result): Result => {
      const lock = LockService.getScriptLock();

      if (!lock.tryLock(LOCK_TIMEOUT_MILLISECONDS)) {
        throw new Error("rate_limit_lock_unavailable");
      }

      try {
        return operation();
      } finally {
        lock.releaseLock();
      }
    },
    getCache: (key) => cache.get(key),
    putCache: (key, value, expirationInSeconds) => cache.put(key, value, expirationInSeconds),
    getDailyState: () => properties.getProperty(DAILY_STATE_PROPERTY),
    setDailyState: (value) => properties.setProperty(DAILY_STATE_PROPERTY, value),
    hashContact: (value) =>
      bytesToHex(
        Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8),
      ),
  };
}
