import { QuickEstimateEmbed } from "@/features/quick-estimate/components/quick-estimate-embed.client";
import { getQuickEstimateEndpoint } from "@/features/quick-estimate/lib/get-quick-estimate-endpoint";

export const metadata = {
  title: "포리펀드 예상 환급액 조회",
  robots: { index: false, follow: false },
};

/** 정적 HTML을 제공하고 설치 모드·부모 origin은 브라우저 경계에서 읽습니다. */
export default function QuickEstimateEmbedPage() {
  return <QuickEstimateEmbed endpoint={getQuickEstimateEndpoint()} />;
}
