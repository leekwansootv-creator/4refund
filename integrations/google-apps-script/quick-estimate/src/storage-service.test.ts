import {
  ESTIMATE_BENCHMARK_VERSION,
  ESTIMATE_RULE_VERSION,
  type EstimateIndustryCode,
} from "@/features/quick-estimate";
import { describe, expect, it, vi } from "vitest";

import {
  MARKETING_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  type QuickEstimateSubmission,
} from "./submission-contract";
import { LEAD_SHEET_HEADERS, type LeadSheetRow } from "./sheet-schema";
import {
  buildLeadSheetRow,
  escapeSpreadsheetCellText,
  storeLeadSubmission,
  type LeadSheetStoragePort,
} from "./storage-service";

const SUBMITTED_AT = "2026-08-06T01:02:03.456Z";
const LEAD_ID = "4d95c6c8-0217-44c7-9d84-e81842721767";

function createSubmission(
  overrides: {
    companyName?: string;
    contactName?: string;
    email?: string;
    marketingAgreed?: boolean;
    marketingChannels?: ("EMAIL" | "SMS")[];
  } = {},
): QuickEstimateSubmission {
  return {
    requestId: "0fca3874-40bc-4ea9-a7ad-742a062736ea",
    estimate: {
      industryCode: "software_it" as EstimateIndustryCode,
      employeeCount: 10,
      amount: 1_270_000,
      currency: "KRW",
      randomUpliftBps: 200,
      ruleVersion: ESTIMATE_RULE_VERSION,
      benchmarkVersion: ESTIMATE_BENCHMARK_VERSION,
    },
    lead: {
      companyName: overrides.companyName ?? "테스트 주식회사",
      contactName: overrides.contactName ?? "테스트 담당자",
      email: overrides.email ?? "test@example.com",
      phone: "01000000000",
    },
    privacy: {
      basis: "CONSENT",
      noticeVersion: PRIVACY_NOTICE_VERSION,
      agreed: true,
    },
    marketing: {
      agreed: overrides.marketingAgreed ?? false,
      channels: overrides.marketingChannels ?? [],
      consentVersion: MARKETING_CONSENT_VERSION,
    },
    sourcePath: "/",
  };
}

function createStorage(overrides: Partial<LeadSheetStoragePort> = {}): LeadSheetStoragePort {
  return {
    withLock: <Result>(operation: () => Result) => operation(),
    findLeadIdByRequestId: () => null,
    appendLeadRow: () => undefined,
    ...overrides,
  };
}

describe("buildLeadSheetRow", () => {
  it("미동의 제출을 승인된 24개 컬럼 순서와 서버 시각으로 변환한다", () => {
    const row = buildLeadSheetRow(createSubmission(), LEAD_ID, SUBMITTED_AT);

    expect(row).toHaveLength(LEAD_SHEET_HEADERS.length);
    expect(
      Object.fromEntries(LEAD_SHEET_HEADERS.map((header, index) => [header, row[index]])),
    ).toEqual({
      lead_id: LEAD_ID,
      request_id: "0fca3874-40bc-4ea9-a7ad-742a062736ea",
      submitted_at: SUBMITTED_AT,
      industry_code: "software_it",
      employee_count: 10,
      estimate_amount_krw: 1_270_000,
      random_uplift_bps: 200,
      estimate_rule_version: ESTIMATE_RULE_VERSION,
      benchmark_version: ESTIMATE_BENCHMARK_VERSION,
      company_name: "테스트 주식회사",
      contact_name: "테스트 담당자",
      email: "test@example.com",
      phone: "01000000000",
      privacy_basis: "CONSENT",
      privacy_notice_version: PRIVACY_NOTICE_VERSION,
      privacy_agreed: true,
      privacy_accepted_at: SUBMITTED_AT,
      marketing_agreed: false,
      marketing_channels: "",
      marketing_consent_version: MARKETING_CONSENT_VERSION,
      marketing_accepted_at: "",
      source_path: "/",
      lead_status: "NEW",
      handled_at: "",
    });
  });

  it("마케팅 동의 시 승인 채널과 서버 기준 동의 시각을 저장한다", () => {
    const row = buildLeadSheetRow(
      createSubmission({ marketingAgreed: true, marketingChannels: ["EMAIL", "SMS"] }),
      LEAD_ID,
      SUBMITTED_AT,
    );
    const record = Object.fromEntries(
      LEAD_SHEET_HEADERS.map((header, index) => [header, row[index]]),
    );

    expect(record.marketing_agreed).toBe(true);
    expect(record.marketing_channels).toBe("EMAIL,SMS");
    expect(record.marketing_accepted_at).toBe(SUBMITTED_AT);
  });

  it.each(["=IMPORTXML()", "+1+1", "-1+1", "@SUM(A1:A2)"])(
    "수식 시작 입력 %s을 일반 텍스트로 이스케이프한다",
    (formulaLikeValue) => {
      expect(escapeSpreadsheetCellText(formulaLikeValue)).toBe(`'${formulaLikeValue}`);
    },
  );
});

describe("storeLeadSubmission", () => {
  it("잠금 안에서 중복 조회 후 신규 행을 한 번 저장한다", () => {
    const events: string[] = [];
    const rows: LeadSheetRow[] = [];
    const storage = createStorage({
      withLock: <Result>(operation: () => Result) => {
        events.push("lock:start");
        const result = operation();
        events.push("lock:end");
        return result;
      },
      findLeadIdByRequestId: () => {
        events.push("find");
        return null;
      },
      appendLeadRow: (row) => {
        events.push("append");
        rows.push(row);
      },
    });

    const result = storeLeadSubmission(createSubmission(), {
      storage,
      generateLeadId: () => LEAD_ID,
      now: () => new Date(SUBMITTED_AT),
    });

    expect(result).toEqual({ ok: true, leadId: LEAD_ID, duplicate: false });
    expect(events).toEqual(["lock:start", "find", "append", "lock:end"]);
    expect(rows).toHaveLength(1);
  });

  it("같은 request_id 재시도는 기존 lead_id를 반환하고 행을 추가하지 않는다", () => {
    const appendLeadRow = vi.fn();
    const result = storeLeadSubmission(createSubmission(), {
      storage: createStorage({
        findLeadIdByRequestId: () => LEAD_ID,
        appendLeadRow,
      }),
      generateLeadId: vi.fn(),
      now: vi.fn(),
    });

    expect(result).toEqual({ ok: true, leadId: LEAD_ID, duplicate: true });
    expect(appendLeadRow).not.toHaveBeenCalled();
  });

  it.each(["잠금 충돌", "quota 초과", "Sheet 쓰기 실패"])(
    "%s를 STORAGE_UNAVAILABLE로 축약한다",
    (failureCase) => {
      const storage = createStorage(
        failureCase === "잠금 충돌"
          ? {
              withLock: () => {
                throw new Error("lock_timeout");
              },
            }
          : failureCase === "quota 초과"
            ? {
                findLeadIdByRequestId: () => {
                  throw new Error("service_invoked_too_many_times");
                },
              }
            : {
                appendLeadRow: () => {
                  throw new Error("sheet_write_failed");
                },
              },
      );

      expect(
        storeLeadSubmission(createSubmission(), {
          storage,
          generateLeadId: () => LEAD_ID,
          now: () => new Date(SUBMITTED_AT),
        }),
      ).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
    },
  );
});
