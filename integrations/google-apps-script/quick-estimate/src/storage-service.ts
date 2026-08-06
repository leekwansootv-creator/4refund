import type { QuickEstimateSubmissionPayload } from "@/features/quick-estimate";
import { LEAD_SHEET_HEADERS, type LeadSheetRow } from "./sheet-schema";

const FORMULA_PREFIX_PATTERN = /^[=+\-@]/u;

/** 잠금 안에서 중복 조회와 한 행 쓰기를 수행하는 Sheet 저장 port입니다. */
export type LeadSheetStoragePort = {
  withLock: <Result>(operation: () => Result) => Result;
  findLeadIdByRequestId: (requestId: string) => string | null;
  appendLeadRow: (row: LeadSheetRow) => void;
};

/** 서버 소유 값과 Sheet 저장 port를 주입하는 리드 저장 의존성입니다. */
export type StoreLeadDependencies = {
  storage: LeadSheetStoragePort;
  generateLeadId: () => string;
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

/** request_id 조회와 쓰기를 같은 잠금에서 실행해 제출 한 건을 한 행으로 저장합니다. */
export function storeLeadSubmission(
  submission: QuickEstimateSubmissionPayload,
  dependencies: StoreLeadDependencies,
): StoreLeadResult {
  try {
    return dependencies.storage.withLock(() => {
      const existingLeadId = dependencies.storage.findLeadIdByRequestId(submission.requestId);

      if (existingLeadId !== null) {
        return {
          ok: true,
          leadId: existingLeadId,
          duplicate: true,
        };
      }

      const leadId = dependencies.generateLeadId();
      const submittedAt = dependencies.now().toISOString();
      const row = buildLeadSheetRow(submission, leadId, submittedAt);

      dependencies.storage.appendLeadRow(row);

      return {
        ok: true,
        leadId,
        duplicate: false,
      };
    });
  } catch {
    return {
      ok: false,
      code: "STORAGE_UNAVAILABLE",
    };
  }
}
