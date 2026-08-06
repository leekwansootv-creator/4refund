/** 운영 leads Sheet에서 순서를 변경할 수 없는 24개 컬럼입니다. */
export const LEAD_SHEET_HEADERS = [
  "lead_id",
  "request_id",
  "submitted_at",
  "industry_code",
  "employee_count",
  "estimate_amount_krw",
  "random_uplift_bps",
  "estimate_rule_version",
  "benchmark_version",
  "company_name",
  "contact_name",
  "email",
  "phone",
  "privacy_basis",
  "privacy_notice_version",
  "privacy_agreed",
  "privacy_accepted_at",
  "marketing_agreed",
  "marketing_channels",
  "marketing_consent_version",
  "marketing_accepted_at",
  "source_path",
  "lead_status",
  "handled_at",
] as const;

/** 담당자가 수정할 수 있는 상담 처리 상태입니다. */
export const LEAD_STATUSES = ["NEW", "CONTACTING", "COMPLETED", "CLOSED"] as const;

/** leads Sheet 한 셀에 저장할 수 있는 값입니다. */
export type LeadSheetCell = string | number | boolean;

/** 고정 header 순서에 맞춰 생성한 leads Sheet 한 행입니다. */
export type LeadSheetRow = readonly LeadSheetCell[];
