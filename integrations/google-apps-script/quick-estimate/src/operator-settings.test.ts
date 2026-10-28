import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ASSIGNEE_PROPERTY, NOTIFICATION_RECIPIENT_PROPERTY } from "./apps-script-config";
import { setupQuickEstimateStorage } from "./apps-script-storage";
import { checkQuickEstimateOperatorSettings, inspectOperatorSettings } from "./operator-settings";

afterEach(() => vi.unstubAllGlobals());

describe("운영자 설정", () => {
  it("미입력 상태를 준비 완료로 표시하지 않는다", () => {
    expect(inspectOperatorSettings(() => null)).toEqual({
      ready: false,
      defaultAssignee: "missing",
      notificationRecipient: "missing",
    });
  });

  it("나중에 입력한 두 설정의 형식만 검사하며 원문을 반환하지 않는다", () => {
    const values: Record<string, string> = {
      [DEFAULT_ASSIGNEE_PROPERTY]: "  담당자  ",
      [NOTIFICATION_RECIPIENT_PROPERTY]: " operator@example.com ",
    };
    const result = inspectOperatorSettings((key) => values[key] ?? null);
    expect(result).toEqual({
      ready: true,
      defaultAssignee: "configured",
      notificationRecipient: "configured",
    });
    expect(JSON.stringify(result)).not.toContain("operator@example.com");
  });

  it.each([
    "a@example.com;b@example.com",
    "A <a@example.com>",
    "a@b",
    "a@example.com,",
    "a@example.com,invalid",
    "a@example.com,\nb@example.com",
    "a@example.com,b@example.com,c@example.com",
  ])("수신자 목록 %s가 잘못되면 전체 준비를 거절한다", (recipient) => {
    expect(
      inspectOperatorSettings((key) => (key === DEFAULT_ASSIGNEE_PROPERTY ? "담당자" : recipient)),
    ).toMatchObject({ ready: false, notificationRecipient: "invalid" });
  });

  it("승인된 두 수신자 설정을 검사하되 주소 원문을 반환하지 않는다", () => {
    const result = inspectOperatorSettings((key) =>
      key === DEFAULT_ASSIGNEE_PROPERTY ? "담당자" : "a@example.com, b@example.com",
    );
    expect(result).toEqual({
      ready: true,
      defaultAssignee: "configured",
      notificationRecipient: "configured",
    });
    expect(JSON.stringify(result)).not.toContain("example.com");
  });

  it("수식 형태의 이름과 입력 전 활성화를 거절하고 Google 부수효과를 호출하지 않는다", () => {
    expect(
      inspectOperatorSettings((key) =>
        key === DEFAULT_ASSIGNEE_PROPERTY ? "=IMPORTXML()" : "operator@example.com",
      ),
    ).toMatchObject({ ready: false, defaultAssignee: "invalid" });
    vi.stubGlobal("PropertiesService", {
      getScriptProperties: () => ({ getProperty: () => null }),
    });
    // 다른 Google service를 제공하지 않아 설정 검사 전에 쓰기·트리거를 호출하면 실패합니다.
    expect(() => setupQuickEstimateStorage()).toThrow("operator_settings_not_ready");
  });

  it("읽기 확인 함수는 Properties 조회와 개인정보 없는 로그만 사용한다", () => {
    vi.stubGlobal("PropertiesService", {
      getScriptProperties: () => ({ getProperty: () => null }),
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(checkQuickEstimateOperatorSettings().ready).toBe(false);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });
});
