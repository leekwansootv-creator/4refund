import { describe, expect, it, vi } from "vitest";

import { checkQuickEstimateConsultationOperations } from "./apps-script-operations";
import type { ConsultationNotificationFailureState } from "./consultation-notification";

const BUSINESS_TIME = "2026-08-10T01:30:00.000Z";

function createDependencies() {
  let failure: ConsultationNotificationFailureState | null = null;
  const sendNotification = vi.fn();
  const clearNotificationFailure = vi.fn(() => {
    failure = null;
  });
  const recordNotificationFailure = vi.fn((event: { code: string; occurredAt: string }) => {
    failure = {
      count: (failure?.count ?? 0) + 1,
      lastCode: event.code,
      lastFailedAt: event.occurredAt,
    };
  });

  return {
    dependencies: {
      syncConsultationRows: vi.fn(() => ({
        createdRows: 0,
        existingRows: 3,
        skippedRows: 0,
      })),
      sendNotification,
      getNotificationFailure: () => failure,
      recordNotificationFailure,
      clearNotificationFailure,
      now: () => new Date(BUSINESS_TIME),
    },
    sendNotification,
    clearNotificationFailure,
    recordNotificationFailure,
    setFailure: (next: ConsultationNotificationFailureState) => {
      failure = next;
    },
  };
}

describe("상담 운영 자동 점검", () => {
  it("업무 시간 밖에는 Sheet를 조회하거나 메일을 보내지 않는다", () => {
    const fixture = createDependencies();
    fixture.dependencies.now = () => new Date("2026-08-09T01:30:00.000Z");

    expect(checkQuickEstimateConsultationOperations(fixture.dependencies)).toEqual({
      alertSent: false,
      checked: false,
      notificationFailures: 0,
      recoveredRows: 0,
    });
    expect(fixture.dependencies.syncConsultationRows).not.toHaveBeenCalled();
    expect(fixture.sendNotification).not.toHaveBeenCalled();
  });

  it("누락과 알림 실패가 없으면 메일을 보내지 않는다", () => {
    const fixture = createDependencies();

    expect(checkQuickEstimateConsultationOperations(fixture.dependencies)).toEqual({
      alertSent: false,
      checked: true,
      notificationFailures: 0,
      recoveredRows: 0,
    });
    expect(fixture.sendNotification).not.toHaveBeenCalled();
  });

  it("누락 상담 행을 복구하면 개인정보 없는 운영 메일을 보낸다", () => {
    const fixture = createDependencies();
    fixture.dependencies.syncConsultationRows.mockReturnValue({
      createdRows: 2,
      existingRows: 1,
      skippedRows: 0,
    });

    expect(checkQuickEstimateConsultationOperations(fixture.dependencies)).toEqual({
      alertSent: true,
      checked: true,
      notificationFailures: 0,
      recoveredRows: 2,
    });
    expect(fixture.sendNotification).toHaveBeenCalledWith({
      subject: "[포리펀드] 상담 운영 확인이 필요합니다",
      body: expect.stringContaining("상담 목록 복구 건수: 2건"),
    });
  });

  it("누적 알림 실패를 알린 뒤 성공한 실패 상태를 제거한다", () => {
    const fixture = createDependencies();
    fixture.setFailure({
      count: 2,
      lastCode: "CONSULTATION_NOTIFICATION_FAILED",
      lastFailedAt: "2026-08-10T01:20:00.000Z",
    });

    expect(checkQuickEstimateConsultationOperations(fixture.dependencies)).toMatchObject({
      alertSent: true,
      notificationFailures: 2,
    });
    expect(fixture.clearNotificationFailure).toHaveBeenCalledOnce();
  });

  it("운영 메일도 실패하면 다음 점검을 위해 실패 상태를 다시 누적한다", () => {
    const fixture = createDependencies();
    fixture.setFailure({
      count: 1,
      lastCode: "CONSULTATION_NOTIFICATION_FAILED",
      lastFailedAt: "2026-08-10T01:20:00.000Z",
    });
    fixture.sendNotification.mockImplementation(() => {
      throw new Error("mail_unavailable");
    });

    expect(checkQuickEstimateConsultationOperations(fixture.dependencies)).toMatchObject({
      alertSent: false,
      notificationFailures: 2,
    });
    expect(fixture.recordNotificationFailure).toHaveBeenCalledWith({
      code: "CONSULTATION_OPERATIONS_ALERT_FAILED",
      occurredAt: BUSINESS_TIME,
    });
  });
});
