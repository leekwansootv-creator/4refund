import { LandingPage } from "@/features/landing-page";
import { QuickEstimateFlow } from "@/features/quick-estimate/components/quick-estimate-flow.client";

const APPS_SCRIPT_WEB_APP_URL_PATTERN =
  /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/u;

function getQuickEstimateEndpoint(): string {
  const endpoint = process.env.NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL?.trim() ?? "";

  return APPS_SCRIPT_WEB_APP_URL_PATTERN.test(endpoint) ? endpoint : "";
}

/**
 * 서비스의 루트 경로에서 랜딩 페이지 feature를 렌더링한다.
 */
export default function HomePage() {
  return (
    <LandingPage
      quickEstimateAction={
        <QuickEstimateFlow endpoint={getQuickEstimateEndpoint()} consultHref="#contact" />
      }
    />
  );
}
