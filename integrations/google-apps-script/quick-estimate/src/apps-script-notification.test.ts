import { describe, expect, it, vi } from "vitest";

import { NOTIFICATION_RECIPIENT_PROPERTY } from "./apps-script-config";
import {
  createAppsScriptConsultationNotifier,
  type AppsScriptNotificationDependencies,
} from "./apps-script-notification";

function createDependencies(
  overrides: Partial<AppsScriptNotificationDependencies> = {},
): AppsScriptNotificationDependencies {
  const properties = new Map<string, string>([
    [NOTIFICATION_RECIPIENT_PROPERTY, "owner@example.com"],
  ]);

  return {
    getProperty: (name) => properties.get(name) ?? null,
    setProperty: (name, value) => {
      properties.set(name, value);
    },
    deleteProperty: (name) => {
      properties.delete(name);
    },
    sendEmail: vi.fn(),
    getOperationsCheckTriggers: () => [],
    createOperationsCheckTrigger: vi.fn(),
    ...overrides,
  };
}

describe("Apps Script 상담 알림 어댑터", () => {
  it("Script Property의 승인 수신자에게 한글 메일을 발송한다", () => {
    const sendEmail = vi.fn();
    const notifier = createAppsScriptConsultationNotifier(createDependencies({ sendEmail }));
    const message = { subject: "상담 알림", body: "상담 목록에서 확인해 주세요." };

    notifier.send(message);

    expect(sendEmail).toHaveBeenCalledWith("owner@example.com", message);
  });

  it("수신자가 없거나 이메일 형식이 아니면 발송하지 않는다", () => {
    const sendEmail = vi.fn();
    const notifier = createAppsScriptConsultationNotifier(
      createDependencies({ getProperty: () => null, sendEmail }),
    );

    expect(() => notifier.send({ subject: "상담 알림", body: "본문" })).toThrow(
      "notification_recipient_not_configured",
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("개인정보 없는 실패 상태를 누적하고 성공 후 제거한다", () => {
    const properties = new Map<string, string>();
    const notifier = createAppsScriptConsultationNotifier(
      createDependencies({
        getProperty: (name) => properties.get(name) ?? null,
        setProperty: (name, value) => {
          properties.set(name, value);
        },
        deleteProperty: (name) => {
          properties.delete(name);
        },
      }),
    );

    notifier.recordFailure({
      code: "CONSULTATION_NOTIFICATION_FAILED",
      occurredAt: "2026-08-10T01:20:00.000Z",
    });
    notifier.recordFailure({
      code: "CONSULTATION_OPERATIONS_ALERT_FAILED",
      occurredAt: "2026-08-10T01:30:00.000Z",
    });

    expect(notifier.getFailure()).toEqual({
      count: 2,
      lastCode: "CONSULTATION_OPERATIONS_ALERT_FAILED",
      lastFailedAt: "2026-08-10T01:30:00.000Z",
    });

    notifier.clearFailure();
    expect(notifier.getFailure()).toBeNull();
  });

  it("30분 운영 점검 trigger를 중복 없이 생성한다", () => {
    const createOperationsCheckTrigger = vi.fn();
    const notifier = createAppsScriptConsultationNotifier(
      createDependencies({ createOperationsCheckTrigger }),
    );

    expect(notifier.ensureOperationsCheckTrigger()).toBe(true);
    expect(createOperationsCheckTrigger).toHaveBeenCalledWith(
      "runQuickEstimateOperationsCheck",
      30,
    );

    const existingNotifier = createAppsScriptConsultationNotifier(
      createDependencies({
        getOperationsCheckTriggers: () => [
          { eventType: "CLOCK", handlerFunction: "runQuickEstimateOperationsCheck" },
        ],
        createOperationsCheckTrigger,
      }),
    );

    expect(existingNotifier.ensureOperationsCheckTrigger()).toBe(false);
    expect(createOperationsCheckTrigger).toHaveBeenCalledOnce();
  });
});
