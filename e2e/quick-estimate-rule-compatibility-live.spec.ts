import { expect, test } from "@playwright/test";

import {
  ESTIMATE_BENCHMARK_VERSION,
  ESTIMATE_RULE_V1_VERSION,
  ESTIMATE_RULE_V2_VERSION,
  MARKETING_CONSENT_VERSION,
  PRIVACY_NOTICE_VERSION,
  calculateEstimate,
  submitEstimateLead,
  type QuickEstimateSubmissionPayload,
} from "@/features/quick-estimate";

const endpoint = process.env.QUICK_ESTIMATE_APPS_SCRIPT_URL;
const runLiveE2e = process.env.QUICK_ESTIMATE_LIVE_E2E === "1" && endpoint !== undefined;

function createCompatibilityPayload(
  ruleVersion: typeof ESTIMATE_RULE_V1_VERSION | typeof ESTIMATE_RULE_V2_VERSION,
): QuickEstimateSubmissionPayload {
  const isV2 = ruleVersion === ESTIMATE_RULE_V2_VERSION;
  const estimate = calculateEstimate({
    industryCode: isV2 ? "N" : "professional_services",
    employeeCount: 25,
    randomUpliftBps: 200,
    ruleVersion,
  });

  if (estimate.status !== "calculated") {
    throw new Error(`${ruleVersion} 호환성 테스트 견적을 생성하지 못했습니다.`);
  }

  const timestamp = Date.now();
  const versionLabel = isV2 ? "v2" : "v1";

  return {
    requestId: crypto.randomUUID(),
    estimate: {
      industryCode: estimate.industryCode,
      employeeCount: estimate.employeeCount,
      amount: estimate.amount,
      currency: estimate.currency,
      randomUpliftBps: estimate.randomUpliftBps,
      ruleVersion: estimate.ruleVersion,
      benchmarkVersion: ESTIMATE_BENCHMARK_VERSION,
    },
    lead: {
      companyName: `4refund E2E 삭제대상 rule-${versionLabel}`,
      contactName: "테스트 담당자",
      email: `quick-estimate-rule-${versionLabel}-${timestamp}@example.test`,
      phone: `010${`${timestamp}${isV2 ? "2" : "1"}`.slice(-8)}`,
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
    antiSpam: {
      honeypot: "",
      elapsedMs: 5_000,
    },
    sourcePath: "/",
  };
}

test.describe("간단 견적 규칙 version 실제 저장 호환성", () => {
  test.skip(!runLiveE2e, "승인된 Apps Script endpoint와 실제 저장 실행 승인이 필요합니다.");

  for (const ruleVersion of [ESTIMATE_RULE_V1_VERSION, ESTIMATE_RULE_V2_VERSION] as const) {
    test(`${ruleVersion} payload를 저장한다`, async () => {
      const result = await submitEstimateLead(createCompatibilityPayload(ruleVersion), {
        endpoint: endpoint ?? "",
      });

      expect(result).toMatchObject({ ok: true, duplicate: false });
    });
  }
});
