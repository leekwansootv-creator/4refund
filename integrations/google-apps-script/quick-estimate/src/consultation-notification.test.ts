import { describe, expect, it } from "vitest";

import {
  accumulateConsultationNotificationFailure,
  buildConsultationOperationsAlert,
  buildNewConsultationNotification,
  isKoreanConsultationBusinessHours,
} from "./consultation-notification";

describe("상담 알림 계약", () => {
  it("신규 접수 메일에 접수 시각만 포함하고 개인정보 필드를 만들지 않는다", () => {
    const notification = buildNewConsultationNotification("2026-08-10T01:18:00.000Z");

    expect(notification).toEqual({
      subject: "[포리펀드] 새 상담 신청이 접수되었습니다",
      body: [
        "새 상담 신청이 접수되었습니다.",
        "",
        "접수 시각: 2026. 08. 10. 오전 10:18",
        "상담 목록에서 확인해 주세요.",
      ].join("\n"),
    });
    expect(JSON.stringify(notification)).not.toMatch(
      /company|contact|email|phone|회사명|고객 담당자|전화번호|예상 환급액/u,
    );
  });

  it("운영 점검 메일에 복구 건수와 개인정보 없는 실패 집계만 포함한다", () => {
    const notification = buildConsultationOperationsAlert({
      checkedAt: "2026-08-10T01:30:00.000Z",
      recoveredRows: 2,
      notificationFailure: {
        count: 1,
        lastCode: "CONSULTATION_NOTIFICATION_FAILED",
        lastFailedAt: "2026-08-10T01:20:00.000Z",
      },
    });

    expect(notification.body).toContain("상담 목록 복구 건수: 2건");
    expect(notification.body).toContain("알림 실패 누적: 1건");
    expect(notification.body).toContain("CONSULTATION_NOTIFICATION_FAILED");
  });

  it.each([
    ["월요일 오전 9시", "2026-08-10T00:00:00.000Z", true],
    ["월요일 오후 5시 59분", "2026-08-10T08:59:00.000Z", true],
    ["월요일 오전 8시 59분", "2026-08-09T23:59:00.000Z", false],
    ["월요일 오후 6시", "2026-08-10T09:00:00.000Z", false],
    ["일요일 오전 10시", "2026-08-09T01:00:00.000Z", false],
  ])("%s의 한국 업무 시간 여부를 판정한다", (_label, timestamp, expected) => {
    expect(isKoreanConsultationBusinessHours(new Date(timestamp))).toBe(expected);
  });

  it("알림 실패 횟수와 마지막 공개 코드를 누적한다", () => {
    const first = accumulateConsultationNotificationFailure(null, {
      code: "CONSULTATION_NOTIFICATION_FAILED",
      occurredAt: "2026-08-10T01:20:00.000Z",
    });

    expect(
      accumulateConsultationNotificationFailure(first, {
        code: "CONSULTATION_OPERATIONS_ALERT_FAILED",
        occurredAt: "2026-08-10T01:30:00.000Z",
      }),
    ).toEqual({
      count: 2,
      lastCode: "CONSULTATION_OPERATIONS_ALERT_FAILED",
      lastFailedAt: "2026-08-10T01:30:00.000Z",
    });
  });
});
