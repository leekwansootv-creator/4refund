import type { QuickEstimateSubmission } from "./submission-contract";
import { createRuntimeLeadSheetStorage } from "./apps-script-storage";
import { storeLeadSubmission, type StoreLeadResult } from "./storage-service";
import { parseAndValidateSubmissionPayload } from "./validate-submission";

/** 브라우저가 JSON body로 판정하는 Apps Script 제출 응답입니다. */
export type QuickEstimateWebResponse =
  | {
      ok: true;
      leadId: string;
      duplicate: boolean;
    }
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "INVALID_CONSENT"
        | "UNSUPPORTED_RULE"
        | "RATE_LIMITED"
        | "STORAGE_UNAVAILABLE"
        | "INTERNAL_ERROR";
    };

type QuickEstimateFailureCode = Extract<QuickEstimateWebResponse, { ok: false }>["code"];

/** 순수 요청 처리기에 주입하는 저장 함수와 개인정보 비포함 실패 logger입니다. */
export type QuickEstimatePostDependencies = {
  storeSubmission: (submission: QuickEstimateSubmission) => StoreLeadResult;
  logFailure: (event: {
    code: QuickEstimateFailureCode;
    occurredAt: string;
    requestId?: string;
  }) => void;
  now: () => Date;
};

function logFailureSafely(
  dependencies: QuickEstimatePostDependencies,
  event: Parameters<QuickEstimatePostDependencies["logFailure"]>[0],
): void {
  try {
    dependencies.logFailure(event);
  } catch {
    // 로깅 장애가 사용자 제출 결과나 개인정보 저장 상태를 바꾸지 않게 격리합니다.
  }
}

/** form payload를 검증하고 Sheet 저장 결과를 공개 응답 계약으로 변환합니다. */
export function handleQuickEstimatePost(
  payload: unknown,
  dependencies: QuickEstimatePostDependencies,
): QuickEstimateWebResponse {
  const validation = parseAndValidateSubmissionPayload(payload);

  if (!validation.ok) {
    logFailureSafely(dependencies, {
      code: validation.code,
      occurredAt: dependencies.now().toISOString(),
    });

    return validation;
  }

  const result = dependencies.storeSubmission(validation.submission);

  if (!result.ok) {
    logFailureSafely(dependencies, {
      code: result.code,
      occurredAt: dependencies.now().toISOString(),
      requestId: validation.submission.requestId,
    });
  }

  return result;
}

function createJsonOutput(response: QuickEstimateWebResponse): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** Apps Script 웹 앱의 POST 진입점에서 form payload를 처리하고 JSON TextOutput을 반환합니다. */
export function doPost(
  event: GoogleAppsScript.Events.DoPost | undefined,
): GoogleAppsScript.Content.TextOutput {
  try {
    const response = handleQuickEstimatePost(event?.parameter.payload, {
      storeSubmission: (submission) =>
        storeLeadSubmission(submission, {
          storage: createRuntimeLeadSheetStorage(),
          generateLeadId: () => Utilities.getUuid(),
          now: () => new Date(),
        }),
      logFailure: (failure) => console.error(JSON.stringify(failure)),
      now: () => new Date(),
    });

    return createJsonOutput(response);
  } catch {
    const response: QuickEstimateWebResponse = { ok: false, code: "INTERNAL_ERROR" };

    console.error(
      JSON.stringify({
        code: response.code,
        occurredAt: new Date().toISOString(),
      }),
    );

    return createJsonOutput(response);
  }
}
