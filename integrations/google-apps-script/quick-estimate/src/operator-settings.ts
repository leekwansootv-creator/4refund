import { DEFAULT_ASSIGNEE_PROPERTY, NOTIFICATION_RECIPIENT_PROPERTY } from "./apps-script-config";
import { validateConsultationAssignee } from "./consultation-status-policy";

type SettingState = "missing" | "invalid" | "configured";

/** 값 원문을 노출하지 않는 담당자·수신자 설정의 형식 검사 결과입니다. */
export type OperatorSettingsCheck = {
  ready: boolean;
  defaultAssignee: SettingState;
  notificationRecipient: SettingState;
};

/** 알림은 주소 하나만 허용하며 수신자 목록이나 표시 이름을 설정으로 받지 않습니다. */
export function isNotificationRecipient(value: string): boolean {
  return value.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/u.test(value);
}

/** 설정을 읽기만 합니다. ready는 형식 검사이며 권한·배포·실제 메일 전달의 증거가 아닙니다. */
export function inspectOperatorSettings(
  getProperty: (name: string) => string | null,
): OperatorSettingsCheck {
  const assignee = getProperty(DEFAULT_ASSIGNEE_PROPERTY)?.trim() ?? "";
  const recipient = getProperty(NOTIFICATION_RECIPIENT_PROPERTY)?.trim() ?? "";
  const defaultAssignee: SettingState = !assignee
    ? "missing"
    : validateConsultationAssignee(assignee).ok
      ? "configured"
      : "invalid";
  const notificationRecipient: SettingState = !recipient
    ? "missing"
    : isNotificationRecipient(recipient)
      ? "configured"
      : "invalid";
  return {
    ready: defaultAssignee === "configured" && notificationRecipient === "configured",
    defaultAssignee,
    notificationRecipient,
  };
}

/** 운영자가 나중에 입력한 설정만 확인하며 시트 쓰기·트리거·메일 발송은 하지 않습니다. */
export function checkQuickEstimateOperatorSettings(): OperatorSettingsCheck {
  const properties = PropertiesService.getScriptProperties();
  const result = inspectOperatorSettings((name) => properties.getProperty(name));
  console.log(JSON.stringify(result));
  return result;
}
