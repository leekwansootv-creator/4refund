import { describe, expect, it, vi } from "vitest";
import {
  calculateEstimate,
  createQuickEstimateSubmissionPayload,
  type QuickEstimateSubmissionPayload,
} from "@/features/quick-estimate";
import { parseAndValidateSubmissionPayload } from "./validate-submission";
import { buildLeadSheetRow, storeLeadSubmission } from "./storage-service";
import { createAppsScriptLeadSheetStorage } from "./apps-script-storage";
import { ATTRIBUTED_LEAD_HEADERS, LEAD_SHEET_HEADERS } from "./sheet-schema";
import {
  ATTRIBUTED_CONSULTATION_HEADERS,
  CONSULTATION_SHEET_HEADERS,
  buildConsultationSourceCells,
} from "./consultation-sheet-schema";
import {
  enforceSubmissionRateLimit,
  parseSubmissionRateLimits,
  type SubmissionRateLimitPort,
} from "./submission-rate-limit";

function payload(attributed = true): QuickEstimateSubmissionPayload {
  const result = createQuickEstimateSubmissionPayload(
    {
      estimate: calculateEstimate({ industryCode: "N", employeeCount: 10, randomUpliftBps: 200 }),
      lead: {
        companyName: "테스트 회사",
        contactName: "테스트",
        email: "qa@example.test",
        phone: "01000000000",
      },
      privacyAgreed: true,
      marketing: { agreed: false, channels: [] },
      antiSpam: { honeypot: "", elapsedMs: 5000 },
      ...(attributed
        ? {
            attribution: {
              channel: "embed" as const,
              siteOrigin: "https://PARTNER.example.:443",
              collectionMethod: "parent_message" as const,
            },
          }
        : {}),
    },
    "0fca3874-40bc-4ea9-a7ad-742a062736ea",
  );
  if (!result.ok) throw new Error("fixture_invalid");
  return result.payload;
}

describe("출처 제출·저장 공존", () => {
  it("v1 shape와 v2 고지·출처를 각각 검증하고 부분 버전·잘못된 출처를 거절한다", () => {
    expect(parseAndValidateSubmissionPayload(JSON.stringify(payload(false))).ok).toBe(true);
    const result = parseAndValidateSubmissionPayload(JSON.stringify(payload()));
    expect(result.ok && result.submission.attribution?.siteOrigin).toBe("https://partner.example");
    for (const bad of [
      { ...payload(false), submissionVersion: 2 },
      { ...payload(), submissionVersion: 3 },
      {
        ...payload(),
        attribution: {
          channel: "embed",
          siteOrigin: "https://x.example/path",
          collectionMethod: "parent_message",
        },
      },
      { ...payload(), attribution: null },
      { ...payload(), privacy: payload(false).privacy },
    ])
      expect(parseAndValidateSubmissionPayload(JSON.stringify(bad)).ok).toBe(false);
    const unknown = {
      ...payload(),
      attribution: { channel: "embed", siteOrigin: null, collectionMethod: "unknown" },
    };
    expect(parseAndValidateSubmissionPayload(JSON.stringify(unknown)).ok).toBe(true);
  });
  it.each([false, true])("확장=%s에서 v1을 보존하며 v2는 확장 후에만 저장한다", (expanded) => {
    const setValues = vi.fn();
    const leadHeaders = expanded ? ATTRIBUTED_LEAD_HEADERS : LEAD_SHEET_HEADERS;
    const queueHeaders = expanded ? ATTRIBUTED_CONSULTATION_HEADERS : CONSULTATION_SHEET_HEADERS;
    const sheet = (headers: readonly string[]) => ({
      getLastRow: () => 1,
      getRange: (row: number) => ({
        getDisplayValues: () => (row === 1 ? [[...headers]] : []),
        setValues,
        setNumberFormat: vi.fn(),
      }),
    });
    const storage = createAppsScriptLeadSheetStorage({
      getScriptLock: () => ({ tryLock: () => true, releaseLock: vi.fn() }),
      getLeadsSheet: () => sheet(leadHeaders),
      getConsultationSheet: () => sheet(queueHeaders),
      isAttributionEnabled: () => expanded,
    });
    storage.appendLeadRow(buildLeadSheetRow(payload(false), "legacy", "date"));
    expect(setValues.mock.calls[0]?.[0][0]).toHaveLength(expanded ? 29 : 24);
    if (expanded)
      expect(setValues.mock.calls[0]?.[0][0].slice(24)).toEqual([
        1,
        "legacy_unknown",
        "",
        "",
        "legacy_absent",
      ]);
    const v2 = parseAndValidateSubmissionPayload(JSON.stringify(payload()));
    if (!v2.ok) throw new Error("fixture");
    const row = buildLeadSheetRow(v2.submission, "new", "date");
    expect(row.slice(24)).toEqual([
      2,
      "embed",
      "partner.example",
      "https://partner.example",
      "parent_message",
    ]);
    expect(buildConsultationSourceCells(row)).toEqual(["partner.example", "부모 페이지 전달"]);
    if (expanded) storage.appendLeadRow(row);
    else expect(() => storage.appendLeadRow(row)).toThrow("attribution_schema_not_ready");
  });
  it("동일 ID 재시도는 출처를 재작성하지 않고 알림도 추가하지 않는다", () => {
    const rows: ReturnType<typeof buildLeadSheetRow>[] = [];
    const notify = vi.fn();
    const dependencies = {
      storage: {
        withLock: <T>(operation: () => T) => operation(),
        findLeadIdByRequestId: () => (rows.length ? "lead" : null),
        appendLeadRow: (row: ReturnType<typeof buildLeadSheetRow>) => {
          rows.push(row);
        },
        syncConsultationRow: vi.fn(),
      },
      generateLeadId: () => "lead",
      now: () => new Date(),
      sendConsultationNotification: notify,
      logConsultationProjectionFailure: vi.fn(),
      recordConsultationNotificationFailure: vi.fn(),
    };
    expect(storeLeadSubmission(payload(), dependencies).ok).toBe(true);
    expect(storeLeadSubmission(payload(), dependencies)).toMatchObject({
      ok: true,
      duplicate: true,
    });
    expect(rows).toHaveLength(1);
    expect(notify).toHaveBeenCalledOnce();
  });
  it("상향 설정도 모든 사이트에 공유되고 잘못된 값은 기본 보호값을 사용한다", () => {
    expect(parseSubmissionRateLimits('{"minute":0,"daily":10000,"contactHourly":3}')).toEqual({
      minute: 10,
      daily: 100,
      contactHourly: 3,
    });
    const cache = new Map<string, string>();
    let daily: string | null = null;
    const port: SubmissionRateLimitPort = {
      withLock: (operation) => operation(),
      getCache: (key) => cache.get(key) ?? null,
      putCache: (key, value) => {
        cache.set(key, value);
      },
      getDailyState: () => daily,
      setDailyState: (value) => {
        daily = value;
      },
      hashContact: (value) => value,
    };
    const dependencies = {
      port,
      now: () => new Date("2026-10-23T00:00:00Z"),
      limits: { minute: 12, daily: 200, contactHourly: 20 },
    };
    for (let index = 0; index < 12; index++)
      expect(
        enforceSubmissionRateLimit({ ...payload(), requestId: `id-${index}` }, dependencies).ok,
      ).toBe(true);
    expect(enforceSubmissionRateLimit({ ...payload(), requestId: "new" }, dependencies).ok).toBe(
      false,
    );
    expect(enforceSubmissionRateLimit({ ...payload(), requestId: "id-0" }, dependencies).ok).toBe(
      true,
    );
  });
});
