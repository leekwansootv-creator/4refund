import { formatKoreanDateTime } from "./consultation-sheet-schema";

/** Apps Script MailApp으로 전송하는 개인정보 없는 상담 운영 메일입니다. */
export type ConsultationNotificationMessage = {
  subject: string;
  body: string;
};

/** 메일 실패를 개인정보 없이 누적하는 운영 상태입니다. */
export type ConsultationNotificationFailureState = {
  count: number;
  lastCode: string;
  lastFailedAt: string;
};

/** 30분 운영 점검이 메일 본문을 만들 때 사용하는 집계값입니다. */
export type ConsultationOperationsAlertInput = {
  checkedAt: string;
  recoveredRows: number;
  notificationFailure: ConsultationNotificationFailureState | null;
};

const KOREAN_TIME_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;

/** 신규 접수 사실과 접수 시각만 포함한 상담 알림 메일을 생성합니다. */
export function buildNewConsultationNotification(
  submittedAt: string,
): ConsultationNotificationMessage {
  return {
    subject: "[포리펀드] 새 상담 신청이 접수되었습니다",
    body: [
      "새 상담 신청이 접수되었습니다.",
      "",
      `접수 시각: ${formatKoreanDateTime(submittedAt)}`,
      "상담 목록에서 확인해 주세요.",
    ].join("\n"),
  };
}

/** 상담 목록 복구와 누적 알림 실패만 포함한 운영 확인 메일을 생성합니다. */
export function buildConsultationOperationsAlert(
  input: ConsultationOperationsAlertInput,
): ConsultationNotificationMessage {
  const failure = input.notificationFailure;

  return {
    subject: "[포리펀드] 상담 운영 확인이 필요합니다",
    body: [
      "상담 운영 자동 점검에서 확인할 항목이 있습니다.",
      "",
      `점검 시각: ${formatKoreanDateTime(input.checkedAt)}`,
      `상담 목록 복구 건수: ${input.recoveredRows}건`,
      `알림 실패 누적: ${failure?.count ?? 0}건`,
      `마지막 실패 코드: ${failure?.lastCode ?? "해당 없음"}`,
      `마지막 실패 시각: ${failure ? formatKoreanDateTime(failure.lastFailedAt) : "해당 없음"}`,
      "상담 목록과 Apps Script 실행 기록을 확인해 주세요.",
    ].join("\n"),
  };
}

/** 승인된 평일 09:00~18:00 한국 업무 시간인지 판정합니다. */
export function isKoreanConsultationBusinessHours(now: Date): boolean {
  const koreanDate = new Date(now.getTime() + KOREAN_TIME_OFFSET_MILLISECONDS);
  const day = koreanDate.getUTCDay();
  const hour = koreanDate.getUTCHours();

  return day >= 1 && day <= 5 && hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

/** 새 실패를 이전 집계에 합치되 공개 가능한 코드와 시각만 보존합니다. */
export function accumulateConsultationNotificationFailure(
  current: ConsultationNotificationFailureState | null,
  failure: { code: string; occurredAt: string },
): ConsultationNotificationFailureState {
  return {
    count: (current?.count ?? 0) + 1,
    lastCode: failure.code,
    lastFailedAt: failure.occurredAt,
  };
}
