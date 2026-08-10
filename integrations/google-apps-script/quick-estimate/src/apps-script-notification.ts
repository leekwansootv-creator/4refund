import {
  accumulateConsultationNotificationFailure,
  type ConsultationNotificationFailureState,
  type ConsultationNotificationMessage,
} from "./consultation-notification";
import {
  NOTIFICATION_FAILURE_PROPERTY,
  NOTIFICATION_RECIPIENT_PROPERTY,
} from "./apps-script-config";

const OPERATIONS_CHECK_HANDLER_FUNCTION_NAME = "runQuickEstimateOperationsCheck";
const OPERATIONS_CHECK_INTERVAL_MINUTES = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/** MailApp, Script Properties와 시간 기반 trigger를 감싼 테스트 가능한 의존성입니다. */
export type AppsScriptNotificationDependencies = {
  getProperty: (name: string) => string | null;
  setProperty: (name: string, value: string) => void;
  deleteProperty: (name: string) => void;
  sendEmail: (recipient: string, message: ConsultationNotificationMessage) => void;
  getOperationsCheckTriggers: () => readonly {
    eventType: string;
    handlerFunction: string;
  }[];
  createOperationsCheckTrigger: (handlerFunction: string, intervalMinutes: number) => void;
};

function parseFailureState(value: string | null): ConsultationNotificationFailureState | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ConsultationNotificationFailureState>;

    if (
      typeof parsed.count !== "number" ||
      !Number.isInteger(parsed.count) ||
      parsed.count <= 0 ||
      typeof parsed.lastCode !== "string" ||
      parsed.lastCode === "" ||
      typeof parsed.lastFailedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.lastFailedAt))
    ) {
      return null;
    }

    return {
      count: parsed.count,
      lastCode: parsed.lastCode,
      lastFailedAt: parsed.lastFailedAt,
    };
  } catch {
    return null;
  }
}

/** Script Property 수신자에게 상담 알림을 발송하고 실패 집계를 관리합니다. */
export function createAppsScriptConsultationNotifier(
  dependencies: AppsScriptNotificationDependencies,
) {
  return {
    send: (message: ConsultationNotificationMessage): void => {
      const recipient = dependencies.getProperty(NOTIFICATION_RECIPIENT_PROPERTY)?.trim() ?? "";

      if (!EMAIL_PATTERN.test(recipient)) {
        throw new Error("notification_recipient_not_configured");
      }

      dependencies.sendEmail(recipient, message);
    },
    recordFailure: (failure: { code: string; occurredAt: string }): void => {
      const current = parseFailureState(
        dependencies.getProperty(NOTIFICATION_FAILURE_PROPERTY),
      );
      const next = accumulateConsultationNotificationFailure(current, failure);

      dependencies.setProperty(NOTIFICATION_FAILURE_PROPERTY, JSON.stringify(next));
    },
    getFailure: (): ConsultationNotificationFailureState | null =>
      parseFailureState(dependencies.getProperty(NOTIFICATION_FAILURE_PROPERTY)),
    clearFailure: (): void => dependencies.deleteProperty(NOTIFICATION_FAILURE_PROPERTY),
    ensureOperationsCheckTrigger: (): boolean => {
      const triggerExists = dependencies.getOperationsCheckTriggers().some(
        (trigger) =>
          trigger.handlerFunction === OPERATIONS_CHECK_HANDLER_FUNCTION_NAME &&
          trigger.eventType === "CLOCK",
      );

      if (triggerExists) {
        return false;
      }

      dependencies.createOperationsCheckTrigger(
        OPERATIONS_CHECK_HANDLER_FUNCTION_NAME,
        OPERATIONS_CHECK_INTERVAL_MINUTES,
      );

      return true;
    },
  };
}

/** 현재 Apps Script의 MailApp, PropertiesService와 ScriptApp에 연결한 알림 port입니다. */
export function createRuntimeConsultationNotifier() {
  const properties = PropertiesService.getScriptProperties();

  return createAppsScriptConsultationNotifier({
    getProperty: (name) => properties.getProperty(name),
    setProperty: (name, value) => {
      properties.setProperty(name, value);
    },
    deleteProperty: (name) => {
      properties.deleteProperty(name);
    },
    sendEmail: (recipient, message) => {
      MailApp.sendEmail(recipient, message.subject, message.body, { name: "포리펀드" });
    },
    getOperationsCheckTriggers: () =>
      ScriptApp.getProjectTriggers().map((trigger) => ({
        eventType: String(trigger.getEventType()),
        handlerFunction: trigger.getHandlerFunction(),
      })),
    createOperationsCheckTrigger: (handlerFunction, intervalMinutes) => {
      ScriptApp.newTrigger(handlerFunction)
        .timeBased()
        .everyMinutes(intervalMinutes)
        .create();
    },
  });
}
