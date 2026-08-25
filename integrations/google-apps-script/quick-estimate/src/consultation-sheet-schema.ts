import { getEstimateIndustryRule } from "@/features/quick-estimate";

import { LEAD_SHEET_HEADERS, LEAD_STATUSES, type LeadSheetRow } from "./sheet-schema";

/** 상담 담당자가 보는 한글 상담 목록의 고정 컬럼입니다. */
export const CONSULTATION_SHEET_HEADERS = [
  "상담 상태",
  "상담 담당자",
  "접수 일시",
  "회사명",
  "고객 담당자",
  "전화번호",
  "이메일",
  "업종",
  "사원 수",
  "예상 환급액",
  "최초 연락 일시",
  "다음 연락 예정일",
  "상담 결과",
  "마케팅 활용 동의",
  "마케팅 허용 방법",
  "상담 신청 번호",
] as const;

/** 상담 목록에서 표시하는 초기 상담 결과입니다. */
export const INITIAL_CONSULTATION_RESULT = "미입력";

/** 승인된 1인 운영에서 신규 상담을 고정 배정하는 담당자 이름입니다. */
export const DEFAULT_CONSULTATION_ASSIGNEE = "이관수";

/** 상담 목록의 업무 입력과 내부 동기화에 사용하는 1부터 시작하는 컬럼 번호입니다. */
export const CONSULTATION_COLUMN_NUMBERS = {
  status: 1,
  assignee: 2,
  firstContactAt: 11,
  nextContactAt: 12,
  result: 13,
  leadId: 16,
} as const;

/** 원본 상담 상태 코드별 한글 표시값입니다. */
export const CONSULTATION_STATUS_LABELS = {
  NEW: "신규 신청",
  CONTACTING: "연락 중",
  COMPLETED: "상담 완료",
  CLOSED: "종결",
} as const satisfies Record<(typeof LEAD_STATUSES)[number], string>;

/** 상담 상태 dropdown에 표시할 한글 선택값입니다. */
export const CONSULTATION_STATUS_OPTIONS = Object.values(CONSULTATION_STATUS_LABELS);

/** 자유 입력을 허용하지 않는 상담 결과 한글 선택값입니다. */
export const CONSULTATION_RESULT_OPTIONS = [
  INITIAL_CONSULTATION_RESULT,
  "연결됨",
  "부재",
  "다시 연락 요청",
  "상담 거절",
  "연락처 오류",
  "중복 신청",
  "상담 완료",
] as const;

/** 상담 목록 한 셀에 저장할 수 있는 값입니다. */
export type ConsultationSheetCell = string | number;

/** 고정 한글 header 순서에 맞춰 생성한 상담 목록 한 행입니다. */
export type ConsultationSheetRow = readonly ConsultationSheetCell[];

type LeadSheetHeader = (typeof LEAD_SHEET_HEADERS)[number];

function getLeadSheetCell(row: LeadSheetRow, header: LeadSheetHeader) {
  return row[LEAD_SHEET_HEADERS.indexOf(header)] ?? "";
}

function toText(value: LeadSheetRow[number]): string {
  return String(value);
}

function toDisplayNumber(value: LeadSheetRow[number]): number | string {
  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : "확인 필요";
}

/** UTC ISO 값을 상담 화면의 한국 날짜·시각 문자열로 변환합니다. */
export function formatKoreanDateTime(value: LeadSheetRow[number]): string {
  const text = toText(value);

  if (text === "") {
    return "";
  }

  const timestamp = Date.parse(text);

  if (!Number.isFinite(timestamp)) {
    return "확인 필요";
  }

  const koreanDate = new Date(timestamp + 9 * 60 * 60 * 1_000);
  const year = koreanDate.getUTCFullYear();
  const month = String(koreanDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(koreanDate.getUTCDate()).padStart(2, "0");
  const hour = koreanDate.getUTCHours();
  const minute = String(koreanDate.getUTCMinutes()).padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;

  return `${year}. ${month}. ${day}. ${period} ${displayHour}:${minute}`;
}

function toKoreanPhoneNumber(value: LeadSheetRow[number]): string {
  const digits = toText(value).replace(/\D/gu, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10 && digits.startsWith("02")) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 9 && digits.startsWith("02")) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  return digits || "확인 필요";
}

function toMarketingAgreement(value: LeadSheetRow[number]): string {
  if (value === true || value === "TRUE") {
    return "동의";
  }

  if (value === false || value === "FALSE") {
    return "미동의";
  }

  return "확인 필요";
}

function toMarketingChannels(agreement: LeadSheetRow[number], value: LeadSheetRow[number]): string {
  if (toMarketingAgreement(agreement) === "미동의") {
    return "해당 없음";
  }

  const channels = new Set(
    toText(value)
      .split(",")
      .map((channel) => channel.trim())
      .filter(Boolean),
  );

  if (channels.size === 2 && channels.has("EMAIL") && channels.has("SMS")) {
    return "이메일·문자";
  }

  if (channels.size === 1 && channels.has("EMAIL")) {
    return "이메일";
  }

  if (channels.size === 1 && channels.has("SMS")) {
    return "문자";
  }

  return "확인 필요";
}

/** 원본 leads 한 행을 내부 코드가 노출되지 않는 한글 상담 목록 행으로 변환합니다. */
export function buildConsultationSheetRow(row: LeadSheetRow): ConsultationSheetRow {
  const status = toText(getLeadSheetCell(row, "lead_status"));
  const industryCode = toText(getLeadSheetCell(row, "industry_code"));
  const estimateRuleVersion = toText(getLeadSheetCell(row, "estimate_rule_version"));
  const marketingAgreement = getLeadSheetCell(row, "marketing_agreed");
  const consultationRow: ConsultationSheetRow = [
    CONSULTATION_STATUS_LABELS[status as keyof typeof CONSULTATION_STATUS_LABELS] ?? "확인 필요",
    DEFAULT_CONSULTATION_ASSIGNEE,
    formatKoreanDateTime(getLeadSheetCell(row, "submitted_at")),
    toText(getLeadSheetCell(row, "company_name")),
    toText(getLeadSheetCell(row, "contact_name")),
    toKoreanPhoneNumber(getLeadSheetCell(row, "phone")),
    toText(getLeadSheetCell(row, "email")),
    getEstimateIndustryRule(estimateRuleVersion, industryCode)?.label ?? "확인 필요",
    toDisplayNumber(getLeadSheetCell(row, "employee_count")),
    toDisplayNumber(getLeadSheetCell(row, "estimate_amount_krw")),
    formatKoreanDateTime(getLeadSheetCell(row, "handled_at")),
    "",
    INITIAL_CONSULTATION_RESULT,
    toMarketingAgreement(marketingAgreement),
    toMarketingChannels(marketingAgreement, getLeadSheetCell(row, "marketing_channels")),
    toText(getLeadSheetCell(row, "lead_id")),
  ];

  if (consultationRow.length !== CONSULTATION_SHEET_HEADERS.length) {
    throw new Error("consultation_sheet_schema_mismatch");
  }

  return consultationRow;
}
