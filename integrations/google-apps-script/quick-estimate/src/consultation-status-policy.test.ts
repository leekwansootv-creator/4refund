import { describe, expect, it } from "vitest";

import {
  getConsultationStatusCode,
  validateConsultationAssignee,
  validateConsultationResult,
  validateConsultationStatusTransition,
  validateNextContactAt,
} from "./consultation-status-policy";

describe("validateConsultationStatusTransition", () => {
  it.each([
    ["신규 신청", "연락 중", "미입력", false, "CONTACTING"],
    ["신규 신청", "종결", "중복 신청", false, "CLOSED"],
    ["연락 중", "상담 완료", "상담 완료", false, "COMPLETED"],
    ["연락 중", "종결", "상담 거절", false, "CLOSED"],
    ["상담 완료", "연락 중", "다시 연락 요청", true, "CONTACTING"],
    ["종결", "연락 중", "다시 연락 요청", true, "CONTACTING"],
  ])(
    "%s에서 %s 전이를 허용한다",
    (previousStatus, nextStatus, result, editorIsOwner, expectedCode) => {
      expect(
        validateConsultationStatusTransition({
          previousStatus,
          nextStatus,
          result,
          editorIsOwner,
        }),
      ).toEqual({ ok: true, value: expectedCode });
    },
  );

  it.each([
    ["신규 신청", "상담 완료", "상담 완료", false, "INVALID_TRANSITION"],
    ["신규 신청", "종결", "미입력", false, "RESULT_REQUIRED"],
    ["연락 중", "상담 완료", "연결됨", false, "RESULT_REQUIRED"],
    ["연락 중", "종결", "부재", false, "RESULT_REQUIRED"],
    ["상담 완료", "연락 중", "다시 연락 요청", false, "OWNER_REQUIRED"],
    ["종결", "연락 중", "다시 연락 요청", false, "OWNER_REQUIRED"],
    ["내부 상태", "연락 중", "미입력", true, "INVALID_STATUS"],
  ])(
    "%s에서 %s 전이의 잘못된 조건을 거부한다",
    (previousStatus, nextStatus, result, editorIsOwner, expectedCode) => {
      expect(
        validateConsultationStatusTransition({
          previousStatus,
          nextStatus,
          result,
          editorIsOwner,
        }),
      ).toMatchObject({ ok: false, code: expectedCode });
    },
  );
});

describe("상담 운영 컬럼 검증", () => {
  it("완료·종결 상태에서 결과와 상태 조합을 검증한다", () => {
    expect(validateConsultationResult("상담 완료", "상담 완료")).toEqual({
      ok: true,
      value: "상담 완료",
    });
    expect(validateConsultationResult("부재", "상담 완료")).toMatchObject({
      ok: false,
      code: "RESULT_REQUIRED",
    });
    expect(validateConsultationResult("상담 거절", "종결")).toEqual({
      ok: true,
      value: "상담 거절",
    });
  });

  it("담당자 이름을 정규화하고 수식·숫자 입력을 거부한다", () => {
    expect(validateConsultationAssignee("  이관수  ")).toEqual({ ok: true, value: "이관수" });
    expect(validateConsultationAssignee("=IMPORTXML()")).toMatchObject({
      ok: false,
      code: "INVALID_ASSIGNEE",
    });
    expect(validateConsultationAssignee("담당자1")).toMatchObject({
      ok: false,
      code: "INVALID_ASSIGNEE",
    });
  });

  it("다음 연락 예정일은 빈 값과 유효한 날짜만 허용한다", () => {
    const date = new Date("2026-08-11T01:00:00.000Z");

    expect(validateNextContactAt("")).toEqual({ ok: true, value: "" });
    expect(validateNextContactAt(date)).toEqual({ ok: true, value: date });
    expect(validateNextContactAt("2026-08-11")).toMatchObject({
      ok: false,
      code: "INVALID_NEXT_CONTACT_AT",
    });
  });

  it("한글 상태만 원본 코드로 변환한다", () => {
    expect(getConsultationStatusCode("연락 중")).toBe("CONTACTING");
    expect(getConsultationStatusCode("CONTACTING")).toBeNull();
  });
});
