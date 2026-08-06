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

/** codebook Sheet에 표시할 leads 컬럼별 운영 설명입니다. */
export const LEAD_SHEET_COLUMN_DESCRIPTIONS = [
  "Apps Script가 생성하는 내부 리드 식별자",
  "브라우저가 생성하고 재시도에서 유지하는 중복 방지 식별자",
  "Apps Script 서버 기준 UTC ISO 접수 시각",
  "견적 계산 업종 코드",
  "견적 계산 사원 수",
  "사용자에게 표시한 원 단위 예상 금액",
  "견적 계산에 사용한 basis point 난수",
  "견적 계산 규칙 버전",
  "외부 기준 snapshot 버전",
  "회사명",
  "담당자 이름",
  "상담 연락 이메일",
  "숫자로 정규화한 상담 연락 전화번호",
  "개인정보 처리 법적 근거 코드",
  "개인정보 수집·이용 고지 버전",
  "필수 개인정보 수집·이용 동의값",
  "Apps Script 서버 기준 개인정보 동의 시각",
  "선택 마케팅 활용 동의값",
  "EMAIL,SMS 중 동의한 마케팅 채널",
  "선택 마케팅 활용 동의 버전",
  "동의한 경우의 Apps Script 서버 기준 마케팅 동의 시각",
  "승인된 유입 경로",
  "NEW, CONTACTING, COMPLETED, CLOSED 중 운영 상태",
  "담당자가 최초 처리를 시작한 UTC ISO 시각",
] as const;

/** leads Sheet 한 셀에 저장할 수 있는 값입니다. */
export type LeadSheetCell = string | number | boolean;

/** 고정 header 순서에 맞춰 생성한 leads Sheet 한 행입니다. */
export type LeadSheetRow = readonly LeadSheetCell[];
