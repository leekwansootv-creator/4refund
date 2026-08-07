import {
  ESTIMATE_BENCHMARK_VERSION,
  ESTIMATE_RULE_VERSION,
  MARKETING_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  type QuickEstimateSubmissionPayload,
} from "@/features/quick-estimate";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { enforceSubmissionRateLimit, type SubmissionRateLimitPort } from "./submission-rate-limit";

const BASE_TIME = "2026-08-07T07:30:00.000Z";

function createSubmission(index = 0): QuickEstimateSubmissionPayload {
  return {
    requestId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    estimate: {
      industryCode: "software_it",
      employeeCount: 10,
      amount: 1_270_000,
      currency: "KRW",
      randomUpliftBps: 200,
      ruleVersion: ESTIMATE_RULE_VERSION,
      benchmarkVersion: ESTIMATE_BENCHMARK_VERSION,
    },
    lead: {
      companyName: "테스트 주식회사",
      contactName: "테스트 담당자",
      email: `person-${index}@example.test`,
      phone: `0100000${String(index).padStart(4, "0")}`,
    },
    privacy: {
      basis: "CONSENT",
      noticeVersion: PRIVACY_NOTICE_VERSION,
      agreed: true,
    },
    marketing: {
      agreed: false,
      channels: [],
      consentVersion: MARKETING_CONSENT_VERSION,
    },
    antiSpam: { honeypot: "", elapsedMs: 5_000 },
    sourcePath: "/",
  };
}

function createFixture() {
  const cache = new Map<string, string>();
  let dailyState: string | null = null;
  const writtenKeys: string[] = [];
  const hashContact = vi.fn((value: string) => createHash("sha256").update(value).digest("hex"));
  const port: SubmissionRateLimitPort = {
    withLock: <Result>(operation: () => Result) => operation(),
    getCache: (key) => cache.get(key) ?? null,
    putCache: (key, value) => {
      writtenKeys.push(key);
      cache.set(key, value);
    },
    getDailyState: () => dailyState,
    setDailyState: (value) => {
      dailyState = value;
    },
    hashContact,
  };

  return {
    port,
    cache,
    writtenKeys,
    hashContact,
    getDailyState: () => dailyState,
  };
}

function enforce(
  submission: QuickEstimateSubmissionPayload,
  port: SubmissionRateLimitPort,
  now = BASE_TIME,
) {
  return enforceSubmissionRateLimit(submission, {
    port,
    now: () => new Date(now),
  });
}

describe("enforceSubmissionRateLimit", () => {
  it("첫 제출은 허용하고 분·일·연락처·request_id 상태를 기록한다", () => {
    const fixture = createFixture();

    expect(enforce(createSubmission(), fixture.port)).toEqual({ ok: true });
    expect(fixture.cache.get("quick-estimate:minute:2026-08-07T07:30")).toBe("1");
    expect(fixture.getDailyState()).toBe('{"date":"2026-08-07","count":1}');
    expect(fixture.writtenKeys).toContain(
      "quick-estimate:seen:00000000-0000-4000-8000-000000000000",
    );
  });

  it("같은 request_id 재시도는 제한 횟수를 다시 차감하지 않는다", () => {
    const fixture = createFixture();
    const submission = createSubmission();

    expect(enforce(submission, fixture.port)).toEqual({ ok: true });
    expect(enforce(submission, fixture.port)).toEqual({ ok: true });
    expect(fixture.cache.get("quick-estimate:minute:2026-08-07T07:30")).toBe("1");
    expect(fixture.getDailyState()).toBe('{"date":"2026-08-07","count":1}');
  });

  it("분당 10건을 넘는 신규 제출을 거절한다", () => {
    const fixture = createFixture();

    for (let index = 0; index < 10; index += 1) {
      expect(enforce(createSubmission(index), fixture.port)).toEqual({ ok: true });
    }

    expect(enforce(createSubmission(10), fixture.port)).toEqual({
      ok: false,
      code: "RATE_LIMITED",
    });
  });

  it("하루 100건을 넘는 신규 제출을 거절한다", () => {
    const fixture = createFixture();

    for (let index = 0; index < 100; index += 1) {
      const minute = String(index % 60).padStart(2, "0");
      const hour = String(Math.floor(index / 60) + 7).padStart(2, "0");

      expect(
        enforce(createSubmission(index), fixture.port, `2026-08-07T${hour}:${minute}:00.000Z`),
      ).toEqual({ ok: true });
    }

    expect(enforce(createSubmission(100), fixture.port, "2026-08-07T09:00:00.000Z")).toEqual({
      ok: false,
      code: "RATE_LIMITED",
    });
  });

  it("같은 정규화 연락처의 시간당 3건을 넘는 제출을 거절한다", () => {
    const fixture = createFixture();
    const first = createSubmission();

    for (let index = 0; index < 3; index += 1) {
      expect(
        enforce({ ...first, requestId: createSubmission(index).requestId }, fixture.port),
      ).toEqual({ ok: true });
    }

    expect(enforce({ ...first, requestId: createSubmission(3).requestId }, fixture.port)).toEqual({
      ok: false,
      code: "RATE_LIMITED",
    });
  });

  it("다음 UTC 고정 구간에서는 분·일·연락처 제한을 새로 계산한다", () => {
    const fixture = createFixture();
    const first = createSubmission();

    for (let index = 0; index < 3; index += 1) {
      enforce({ ...first, requestId: createSubmission(index).requestId }, fixture.port);
    }

    expect(
      enforce(
        { ...first, requestId: createSubmission(3).requestId },
        fixture.port,
        "2026-08-07T08:00:00.000Z",
      ),
    ).toEqual({ ok: true });
    expect(enforce(createSubmission(4), fixture.port, "2026-08-08T00:00:00.000Z")).toEqual({
      ok: true,
    });
    expect(fixture.getDailyState()).toBe('{"date":"2026-08-08","count":1}');
  });

  it("연락처 원문을 cache key와 일일 상태에 남기지 않는다", () => {
    const fixture = createFixture();
    const submission = createSubmission();

    enforce(submission, fixture.port);

    const persistedState = `${fixture.writtenKeys.join("\n")}\n${fixture.getDailyState()}`;
    expect(fixture.hashContact).toHaveBeenCalledWith("person-0@example.test\u000001000000000");
    expect(persistedState).not.toContain(submission.lead.email);
    expect(persistedState).not.toContain(submission.lead.phone);
  });

  it("손상된 카운터 상태를 임의로 허용하지 않는다", () => {
    const fixture = createFixture();
    fixture.cache.set("quick-estimate:minute:2026-08-07T07:30", "invalid");

    expect(() => enforce(createSubmission(), fixture.port)).toThrow("invalid_rate_limit_counter");
  });
});
