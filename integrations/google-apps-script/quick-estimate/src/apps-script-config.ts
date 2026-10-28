/** 운영 Spreadsheet ID를 저장하는 Apps Script Property 이름입니다. */
export const SPREADSHEET_ID_PROPERTY = "QUICK_ESTIMATE_SPREADSHEET_ID";

/** 신규 상담과 운영 점검 메일 수신자 최대 두 주소를 쉼표로 저장하는 Script Property입니다. */
export const NOTIFICATION_RECIPIENT_PROPERTY = "QUICK_ESTIMATE_NOTIFICATION_RECIPIENT";

/** 신규 상담의 기본 담당자이며 비어 있으면 자동 배정하지 않습니다. */
export const DEFAULT_ASSIGNEE_PROPERTY = "QUICK_ESTIMATE_DEFAULT_ASSIGNEE";

/** 개인정보 없는 메일 실패 집계를 저장하는 Script Property 이름입니다. */
export const NOTIFICATION_FAILURE_PROPERTY = "QUICK_ESTIMATE_NOTIFICATION_FAILURE";

/** 원본 상담 신청을 보존하는 기술 Sheet 이름입니다. */
export const LEADS_SHEET_NAME = "leads";

/** 상담 담당자가 사용하는 한글 업무 Sheet 이름입니다. */
export const CONSULTATION_SHEET_NAME = "상담 목록";

/** Apps Script 동시 실행을 기다리는 최대 시간입니다. */
export const LOCK_TIMEOUT_MILLISECONDS = 5_000;
