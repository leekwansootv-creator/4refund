import { describe, expect, it } from "vitest";

import { LEAD_SHEET_HEADERS, type LeadSheetCell, type LeadSheetRow } from "./sheet-schema";
import { buildConsultationSheetRow, CONSULTATION_SHEET_HEADERS } from "./consultation-sheet-schema";

function createLeadRow(
  overrides: Partial<Record<(typeof LEAD_SHEET_HEADERS)[number], LeadSheetCell>> = {},
) {
  const values: Record<(typeof LEAD_SHEET_HEADERS)[number], LeadSheetCell> = {
    lead_id: "lead-a",
    request_id: "request-a",
    submitted_at: "2026-08-10T01:18:00.000Z",
    industry_code: "software_it",
    employee_count: 100,
    estimate_amount_krw: 10_870_000,
    random_uplift_bps: 200,
    estimate_rule_version: "rule-v1",
    benchmark_version: "benchmark-v1",
    company_name: "테스트 주식회사",
    contact_name: "홍길동",
    email: "test@example.com",
    phone: "01000000000",
    privacy_basis: "CONSENT",
    privacy_notice_version: "privacy-v1",
    privacy_agreed: true,
    privacy_accepted_at: "2026-08-10T01:18:00.000Z",
    marketing_agreed: false,
    marketing_channels: "",
    marketing_consent_version: "marketing-v1",
    marketing_accepted_at: "",
    source_path: "/",
    lead_status: "NEW",
    handled_at: "",
    ...overrides,
  };

  return LEAD_SHEET_HEADERS.map((header) => values[header]) satisfies LeadSheetRow;
}

describe("buildConsultationSheetRow", () => {
  it("원본 내부 값을 16개 한글 상담 컬럼과 한국 시각으로 변환한다", () => {
    const row = buildConsultationSheetRow(createLeadRow());

    expect(row).toHaveLength(CONSULTATION_SHEET_HEADERS.length);
    expect(
      Object.fromEntries(CONSULTATION_SHEET_HEADERS.map((header, index) => [header, row[index]])),
    ).toEqual({
      "상담 상태": "신규 신청",
      "상담 담당자": "이관수",
      "접수 일시": "2026. 08. 10. 오전 10:18",
      회사명: "테스트 주식회사",
      "고객 담당자": "홍길동",
      전화번호: "010-0000-0000",
      이메일: "test@example.com",
      업종: "IT·소프트웨어",
      "사원 수": 100,
      "예상 환급액": 10_870_000,
      "최초 연락 일시": "",
      "다음 연락 예정일": "",
      "상담 결과": "미입력",
      "마케팅 활용 동의": "미동의",
      "마케팅 허용 방법": "해당 없음",
      "상담 신청 번호": "lead-a",
    });
  });

  it.each([
    ["EMAIL", "이메일"],
    ["SMS", "문자"],
    ["EMAIL,SMS", "이메일·문자"],
  ])("마케팅 채널 %s을 한글 표시값 %s로 바꾼다", (channels, expected) => {
    const row = buildConsultationSheetRow(
      createLeadRow({ marketing_agreed: true, marketing_channels: channels }),
    );

    expect(row[13]).toBe("동의");
    expect(row[14]).toBe(expected);
  });

  it("승인되지 않은 내부 코드와 손상된 값은 원문 대신 확인 필요로 표시한다", () => {
    const row = buildConsultationSheetRow(
      createLeadRow({
        lead_status: "UNKNOWN",
        industry_code: "internal_unknown",
        submitted_at: "not-a-date",
        employee_count: "not-a-number",
        marketing_agreed: "UNKNOWN",
      }),
    );

    expect(row[0]).toBe("확인 필요");
    expect(row[2]).toBe("확인 필요");
    expect(row[7]).toBe("확인 필요");
    expect(row[8]).toBe("확인 필요");
    expect(row[13]).toBe("확인 필요");
    expect(row[14]).toBe("확인 필요");
  });
});
