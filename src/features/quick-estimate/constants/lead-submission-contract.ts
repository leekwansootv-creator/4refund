/** 현재 상담 제출에서 사용하는 개인정보 수집·이용 고지 버전입니다. */
export const PRIVACY_NOTICE_VERSION = "privacy-2026-08-06-v1";

/** 현재 상담 제출에서 사용하는 선택 마케팅 동의 버전입니다. */
export const MARKETING_CONSENT_VERSION = "marketing-2026-08-06-v1";

/** Apps Script의 form field 하나에 담을 JSON payload 최대 UTF-8 크기입니다. */
export const SUBMISSION_PAYLOAD_MAX_BYTES = 16 * 1024;

/** 자동 입력을 거르되 일반 사용자의 입력을 방해하지 않는 최소 폼 체류 시간입니다. */
export const MIN_SUBMISSION_ELAPSED_MS = 3_000;

/** 장시간 열린 탭의 오래된 제출 metadata를 새 흐름으로 다시 시작하게 하는 상한입니다. */
export const MAX_SUBMISSION_ELAPSED_MS = 2 * 60 * 60 * 1_000;
