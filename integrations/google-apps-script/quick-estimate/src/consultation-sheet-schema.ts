import { ESTIMATE_RULE_SET } from "@/features/quick-estimate";

import { LEAD_SHEET_HEADERS, type LeadSheetRow } from "./sheet-schema";

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

/** 상담 목록 한 셀에 저장할 수 있는 값입니다. */
export type ConsultationSheetCell = string | number;

/** 고정 한글 header 순서에 맞춰 생성한 상담 목록 한 행입니다. */
export type ConsultationSheetRow = readonly ConsultationSheetCell[];

type LeadSheetHeader = (typeof LEAD_SHEET_HEADERS)[number];

const STATUS_LABELS: Readonly<Record<string, string>> = {
  NEW: "신규 신청",
  CONTACTING: "연락 중",
  COMPLETED: "상담 완료",
  CLOSED: "종결",
};

const INDUSTRY_LABELS = new Map<string, string>(
  ESTIMATE_RULE_SET.industries.map((industry) => [industry.code, industry.label]),
);

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

function toKoreanDateTime(value: LeadSheetRow[number]): string {
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
  const marketingAgreement = getLeadSheetCell(row, "marketing_agreed");
  const consultationRow: ConsultationSheetRow = [
    STATUS_LABELS[status] ?? "확인 필요",
    "",
    toKoreanDateTime(getLeadSheetCell(row, "submitted_at")),
    toText(getLeadSheetCell(row, "company_name")),
    toText(getLeadSheetCell(row, "contact_name")),
    toKoreanPhoneNumber(getLeadSheetCell(row, "phone")),
    toText(getLeadSheetCell(row, "email")),
    INDUSTRY_LABELS.get(industryCode) ?? "확인 필요",
    toDisplayNumber(getLeadSheetCell(row, "employee_count")),
    toDisplayNumber(getLeadSheetCell(row, "estimate_amount_krw")),
    toKoreanDateTime(getLeadSheetCell(row, "handled_at")),
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
