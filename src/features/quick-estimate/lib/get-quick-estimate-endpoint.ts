/** 빌드에서 제공한 Apps Script 공개 URL만 사용하며 설치자가 endpoint를 바꾸지 못하게 합니다. */
export function getQuickEstimateEndpoint(): string {
  const endpoint = process.env.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL?.trim() ?? "";
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/u.test(endpoint)
    ? endpoint
    : "";
}
