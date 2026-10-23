import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKETING_CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from "@/features/quick-estimate";
import { ATTRIBUTION_CODEBOOK_ROWS } from "./attribution-migration";
import { ATTRIBUTED_CONSULTATION_HEADERS } from "./consultation-sheet-schema";
import {
  assertEmptyPreparationTarget,
  matchesPreparationValidation,
  prepareEmptyQuickEstimateStorage,
  type EmptyPreparationSnapshot,
} from "./empty-storage-preparation";
import {
  ATTRIBUTED_LEAD_HEADERS,
  LEAD_SHEET_COLUMN_DESCRIPTIONS,
  LEAD_SHEET_HEADERS,
  LEAD_STATUSES,
} from "./sheet-schema";

function snapshot(): EmptyPreparationSnapshot {
  return {
    configuredId: "new-empty-sheet",
    confirmedId: "new-empty-sheet",
    expectedOwner: "owner@example.com",
    owner: "owner@example.com",
    executor: "owner@example.com",
    sheetNames: ["상담 목록", "leads", "codebook"],
    leads: [[...ATTRIBUTED_LEAD_HEADERS]],
    queue: [[...ATTRIBUTED_CONSULTATION_HEADERS]],
    hasFormulas: false,
    codebook: [
      ["category", "code", "description"],
      ...LEAD_SHEET_HEADERS.map((name, i) => [
        "column",
        name,
        LEAD_SHEET_COLUMN_DESCRIPTIONS[i] ?? "",
      ]),
      ...LEAD_STATUSES.map((status) => ["lead_status", status, "허용 운영 상태"]),
      ["privacy_notice_version", PRIVACY_NOTICE_VERSION, "기존 v1 요청용 개인정보 고지 버전"],
      ["marketing_consent_version", MARKETING_CONSENT_VERSION, "현재 선택 마케팅 활용 동의 버전"],
      ["retention", "P1Y", "접수일로부터 1년 보유 후 월 1회 파기 대상 확인"],
      ...ATTRIBUTION_CODEBOOK_ROWS.map((row) => [...row]),
    ],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Google 검증 규칙 readback", () => {
  const formulaB3 =
    '=OR(B3="",AND(LEN(TRIM(B3))<=30,REGEXMATCH(TRIM(B3),"^[가-힣A-Za-z][가-힣A-Za-z\\s·-]{0,29}$")))';
  const expected = {
    type: "CUSTOM_FORMULA",
    values: [formulaB3.replaceAll("B3", "B2")],
    rowNumber: 3,
  };
  it("실제 Google이 반환한 B3 상대 참조를 정상으로 확인한다", () => {
    expect(
      matchesPreparationValidation(
        { type: "CUSTOM_FORMULA", values: [formulaB3], allowInvalid: false },
        expected,
      ),
    ).toBe(true);
  });
  it("B3 셀이 B2를 검사하거나 잘못된 입력을 허용하면 실패한다", () => {
    expect(
      matchesPreparationValidation(
        { type: "CUSTOM_FORMULA", values: [formulaB3.replaceAll("B3", "B2")], allowInvalid: false },
        expected,
      ),
    ).toBe(false);
    expect(
      matchesPreparationValidation(
        { type: "CUSTOM_FORMULA", values: [formulaB3], allowInvalid: true },
        expected,
      ),
    ).toBe(false);
  });
  it("일반 목록 검증은 값·종류·누락까지 정확히 비교한다", () => {
    const expectedList = { type: "VALUE_IN_LIST", values: [["NEW"], true], rowNumber: 3 };
    expect(
      matchesPreparationValidation(
        { type: "VALUE_IN_LIST", values: [["NEW"], true], allowInvalid: false },
        expectedList,
      ),
    ).toBe(true);
    expect(
      matchesPreparationValidation(
        { type: "VALUE_IN_LIST", values: [["OTHER"], true], allowInvalid: false },
        expectedList,
      ),
    ).toBe(false);
    expect(matchesPreparationValidation(null, expectedList)).toBe(false);
  });
});

describe("빈 신규 시트 준비의 변경 전 안전 조건", () => {
  it("별도 확인한 소유자와 정확한 29/18/40 빈 계약만 허용한다", () => {
    expect(() => assertEmptyPreparationTarget(snapshot())).not.toThrow();
  });
  it.each([
    ["target", { confirmedId: "existing-production-sheet" }, "preparation_target_not_confirmed"],
    ["unset target", { configuredId: null }, "preparation_target_not_confirmed"],
    ["executor", { executor: "other@example.com" }, "preparation_owner_mismatch"],
    ["owner", { owner: "other@example.com" }, "preparation_owner_mismatch"],
    ["unset owner", { expectedOwner: null }, "preparation_owner_mismatch"],
    [
      "extra tab",
      { sheetNames: ["상담 목록", "leads", "codebook", "other"] },
      "preparation_unexpected_sheet",
    ],
    ["formula", { hasFormulas: true }, "preparation_requires_empty_storage"],
    [
      "legacy header",
      { leads: [[...LEAD_SHEET_HEADERS]] },
      "preparation_requires_attributed_headers",
    ],
    [
      "codebook changed",
      { codebook: [["category", "code", "description"]] },
      "preparation_codebook_mismatch",
    ],
  ] satisfies [string, Partial<EmptyPreparationSnapshot>, string][])(
    "%s이면 중단한다",
    (_name, changes, message) => {
      expect(() => assertEmptyPreparationTarget({ ...snapshot(), ...changes })).toThrow(message);
    },
  );
  it.each(["leads", "queue"] as const)("%s에 업무 행이 하나라도 있으면 변경을 거부한다", (name) => {
    const data = snapshot();
    data[name].push(["existing record"]);
    expect(() => assertEmptyPreparationTarget(data)).toThrow("preparation_requires_empty_storage");
  });
  it("대상 ID 확인 전에는 Google 시트를 열지도 않는다", () => {
    const openById = vi.fn();
    const setProperty = vi.fn();
    vi.stubGlobal("PropertiesService", {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          key === "QUICK_ESTIMATE_SPREADSHEET_ID" ? "existing-production-sheet" : null,
        setProperty,
      }),
    });
    vi.stubGlobal("SpreadsheetApp", { openById });
    expect(() => prepareEmptyQuickEstimateStorage()).toThrow("preparation_target_not_confirmed");
    expect(openById).not.toHaveBeenCalled();
    expect(setProperty).not.toHaveBeenCalled();
  });
});
