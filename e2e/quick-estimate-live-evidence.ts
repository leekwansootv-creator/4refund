import { createHash } from "node:crypto";
import { test } from "@playwright/test";
import type { QuickEstimateSubmissionPayload } from "../src/features/quick-estimate";

/** 실제 저장 대조에 필요한 계약 값과 연락처 지문만 남기고 입력 원문은 제외합니다. */
export async function recordLiveSubmissionEvidence(payload: QuickEstimateSubmissionPayload) {
  const { companyName, contactName, email, phone } = payload.lead;
  await test.info().attach("live-submission-evidence", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify({
        requestId: payload.requestId,
        estimate: payload.estimate,
        privacy: payload.privacy,
        marketing: payload.marketing,
        sourcePath: payload.sourcePath,
        dummyData: companyName.startsWith("4refund E2E 삭제대상") && email.endsWith(".test"),
        contactHash: createHash("sha256")
          .update(JSON.stringify([companyName, contactName, email, phone]))
          .digest("hex"),
      }),
    ),
  });
}
