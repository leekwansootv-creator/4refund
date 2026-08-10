import type { QuickEstimateSubmissionPayload } from "@/features/quick-estimate";
import {
  buildNewConsultationNotification,
  type ConsultationNotificationMessage,
} from "./consultation-notification";
import { LEAD_SHEET_HEADERS, type LeadSheetRow } from "./sheet-schema";

const FORMULA_PREFIX_PATTERN = /^[=+\-@]/u;

/** 잠금 안에서 중복 조회와 한 행 쓰기를 수행하는 Sheet 저장 port입니다. */
export type LeadSheetStoragePort = {
  withLock: <Result>(operation: () => Result) => Result;
  findLeadIdByRequestId: (requestId: string) => string | null;
  appendLeadRow: (row: LeadSheetRow) => void;
  syncConsultationRow: (row: LeadSheetRow) => void;
};

/** 서버 소유 값과 Sheet 저장 port를 주입하는 리드 저장 의존성입니다. */
export type StoreLeadDependencies = {
  storage: LeadSheetStoragePort;
  generateLeadId: () => string;
  logConsultationProjectionFailure: (event: {
    code: "CONSULTATION_QUEUE_SYNC_FAILED";
    leadId: string;
    occurredAt: string;
  }) => void;
  sendConsultationNotification: (message: ConsultationNotificationMessage) => void;
  recordConsultationNotificationFailure: (event: {
    code: "CONSULTATION_NOTIFICATION_FAILED";
    occurredAt: string;
  }) => void;
  now: () => Date;
};

/** 신규 또는 중복 제출의 저장 결과와 공개 가능한 실패 코드입니다. */
export type StoreLeadResult =
  | {
      ok: true;
      leadId: string;
      duplicate: boolean;
    }
  | {
      ok: false;
      code: "STORAGE_UNAVAILABLE";
    };

/** Sheet가 수식으로 해석하는 시작 문자를 일반 텍스트로 이스케이프합니다. */
export function escapeSpreadsheetCellText(value: string): string {
  return FORMULA_PREFIX_PATTERN.test(value) ? `'${value}` : value;
}

/** 검증된 제출값과 서버 소유 값을 고정된 24개 Sheet 컬럼으로 변환합니다. */
export function buildLeadSheetRow(
  submission: QuickEstimateSubmissionPayload,
  leadId: string,
  submittedAt: string,
): LeadSheetRow {
  const marketingAcceptedAt = submission.marketing.agreed ? submittedAt : "";

  const row: LeadSheetRow = [
    leadId,
    submission.requestId,
    submittedAt,
    submission.estimate.industryCode,
    submission.estimate.employeeCount,
    submission.estimate.amount,
    submission.estimate.randomUpliftBps,
    submission.estimate.ruleVersion,
    submission.estimate.benchmarkVersion,
    escapeSpreadsheetCellText(submission.lead.companyName),
    escapeSpreadsheetCellText(submission.lead.contactName),
    escapeSpreadsheetCellText(submission.lead.email),
    submission.lead.phone,
    submission.privacy.basis,
    submission.privacy.noticeVersion,
    submission.privacy.agreed,
    submittedAt,
    submission.marketing.agreed,
    submission.marketing.channels.join(","),
    submission.marketing.consentVersion,
    marketingAcceptedAt,
    submission.sourcePath,
    "NEW",
    "",
  ];

  if (row.length !== LEAD_SHEET_HEADERS.length) {
    throw new Error("lead_sheet_schema_mismatch");
  }

  return row;
}

function syncConsultationRowSafely(
  row: LeadSheetRow,
  leadId: string,
  submittedAt: string,
  dependencies: StoreLeadDependencies,
): void {
  try {
    dependencies.storage.syncConsultationRow(row);
  } catch {
    try {
      dependencies.logConsultationProjectionFailure({
        code: "CONSULTATION_QUEUE_SYNC_FAILED",
        leadId,
        occurredAt: submittedAt,
      });
    } catch {
      // 파생 목록과 logger 장애가 원본 leads 저장 성공을 되돌리지 않게 격리합니다.
    }
  }
}

function sendConsultationNotificationSafely(
  message: ConsultationNotificationMessage,
  occurredAt: string,
  dependencies: StoreLeadDependencies,
): void {
  try {
    dependencies.sendConsultationNotification(message);
  } catch {
    try {
      dependencies.recordConsultationNotificationFailure({
        code: "CONSULTATION_NOTIFICATION_FAILED",
        occurredAt,
      });
    } catch {
      // 알림과 실패 기록 장애가 이미 완료된 원본 저장 결과를 바꾸지 않게 격리합니다.
    }
  }
}

/** request_id 조회와 쓰기를 같은 잠금에서 실행해 제출 한 건을 한 행으로 저장합니다. */
export function storeLeadSubmission(
  submission: QuickEstimateSubmissionPayload,
  dependencies: StoreLeadDependencies,
): StoreLeadResult {
  try {
    const operation = dependencies.storage.withLock<{
      notification: ConsultationNotificationMessage | null;
      result: StoreLeadResult;
      submittedAt: string | null;
    }>(() => {
      const existingLeadId = dependencies.storage.findLeadIdByRequestId(submission.requestId);

      if (existingLeadId !== null) {
        return {
          notification: null,
          result: {
            ok: true,
            leadId: existingLeadId,
            duplicate: true,
          },
          submittedAt: null,
        };
      }

      const leadId = dependencies.generateLeadId();
      const submittedAt = dependencies.now().toISOString();
      const row = buildLeadSheetRow(submission, leadId, submittedAt);

      dependencies.storage.appendLeadRow(row);
      syncConsultationRowSafely(row, leadId, submittedAt, dependencies);

      return {
        notification: buildNewConsultationNotification(submittedAt),
        result: {
          ok: true,
          leadId,
          duplicate: false,
        },
        submittedAt,
      };
    });

    if (operation.notification !== null && operation.submittedAt !== null) {
      sendConsultationNotificationSafely(
        operation.notification,
        operation.submittedAt,
        dependencies,
      );
    }

    return operation.result;
  } catch {
    return {
      ok: false,
      code: "STORAGE_UNAVAILABLE",
    };
  }
}
