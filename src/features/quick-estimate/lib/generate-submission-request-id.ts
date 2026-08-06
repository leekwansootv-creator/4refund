/** 브라우저 UUID 생성기를 테스트에서 대체하는 요청 식별자 source입니다. */
export type SubmissionRequestIdSource = {
  randomUUID: () => string;
};

/** 새 상담 제출에 사용할 UUID를 브라우저의 보안 난수 source에서 생성합니다. */
export function generateSubmissionRequestId(
  source: SubmissionRequestIdSource = { randomUUID: () => crypto.randomUUID() },
): string {
  return source.randomUUID();
}
