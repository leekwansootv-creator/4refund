import { createRuntimeConsultationNotifier } from "./apps-script-notification";
import { syncQuickEstimateConsultationRows } from "./apps-script-storage";
import {
  buildConsultationOperationsAlert,
  isKoreanConsultationBusinessHours,
  type ConsultationNotificationFailureState,
  type ConsultationNotificationMessage,
} from "./consultation-notification";
import type { ConsultationSheetSyncResult } from "./consultation-sheet-projection";

/** 30분 운영 점검의 누락 복구·알림 결과입니다. */
export type ConsultationOperationsCheckResult = {
  alertSent: boolean;
  checked: boolean;
  notificationFailures: number;
  recoveredRows: number;
};

/** 상담 목록 재동기화와 개인정보 없는 운영 알림을 조합하는 의존성입니다. */
export type ConsultationOperationsCheckDependencies = {
  syncConsultationRows: () => ConsultationSheetSyncResult;
  sendNotification: (message: ConsultationNotificationMessage) => void;
  getNotificationFailure: () => ConsultationNotificationFailureState | null;
  recordNotificationFailure: (failure: { code: string; occurredAt: string }) => void;
  clearNotificationFailure: () => void;
  now: () => Date;
};

/** 승인된 업무 시간에 누락 상담 행과 알림 실패를 점검하고 이상이 있을 때만 메일을 보냅니다. */
export function checkQuickEstimateConsultationOperations(
  dependencies: ConsultationOperationsCheckDependencies,
): ConsultationOperationsCheckResult {
  const now = dependencies.now();

  if (!isKoreanConsultationBusinessHours(now)) {
    return {
      alertSent: false,
      checked: false,
      notificationFailures: dependencies.getNotificationFailure()?.count ?? 0,
      recoveredRows: 0,
    };
  }

  const checkedAt = now.toISOString();
  let recoveredRows = 0;

  try {
    recoveredRows = dependencies.syncConsultationRows().createdRows;
  } catch {
    dependencies.recordNotificationFailure({
      code: "CONSULTATION_QUEUE_CHECK_FAILED",
      occurredAt: checkedAt,
    });
  }

  const failure = dependencies.getNotificationFailure();

  if (recoveredRows === 0 && failure === null) {
    return {
      alertSent: false,
      checked: true,
      notificationFailures: 0,
      recoveredRows: 0,
    };
  }

  try {
    dependencies.sendNotification(
      buildConsultationOperationsAlert({
        checkedAt,
        recoveredRows,
        notificationFailure: failure,
      }),
    );
    dependencies.clearNotificationFailure();

    return {
      alertSent: true,
      checked: true,
      notificationFailures: failure?.count ?? 0,
      recoveredRows,
    };
  } catch {
    dependencies.recordNotificationFailure({
      code: "CONSULTATION_OPERATIONS_ALERT_FAILED",
      occurredAt: checkedAt,
    });

    return {
      alertSent: false,
      checked: true,
      notificationFailures: dependencies.getNotificationFailure()?.count ?? 0,
      recoveredRows,
    };
  }
}

/** Apps Script 시간 기반 trigger가 호출하는 상담 운영 점검 전역 진입점입니다. */
export function runQuickEstimateOperationsCheck(): ConsultationOperationsCheckResult {
  const notifier = createRuntimeConsultationNotifier();

  return checkQuickEstimateConsultationOperations({
    syncConsultationRows: syncQuickEstimateConsultationRows,
    sendNotification: notifier.send,
    getNotificationFailure: notifier.getFailure,
    recordNotificationFailure: (failure) => {
      notifier.recordFailure(failure);
      console.error(JSON.stringify(failure));
    },
    clearNotificationFailure: notifier.clearFailure,
    now: () => new Date(),
  });
}
