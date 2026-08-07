const quickEstimateBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function toQuickEstimateAssetPath(path: `/assets/quick-estimate/${string}`) {
  return `${quickEstimateBasePath}${path}`;
}

/**
 * Figma에서 추출해 저장소에 고정한 간단 견적 UI 에셋 경로입니다.
 */
export const QUICK_ESTIMATE_ASSETS = {
  envelope: {
    back: toQuickEstimateAssetPath("/assets/quick-estimate/envelope-back.png"),
    paper: toQuickEstimateAssetPath("/assets/quick-estimate/estimate-paper.png"),
    frontShadow: toQuickEstimateAssetPath("/assets/quick-estimate/envelope-front-shadow.png"),
    front: toQuickEstimateAssetPath("/assets/quick-estimate/envelope-front.png"),
  },
  coins: toQuickEstimateAssetPath("/assets/quick-estimate/coins.png"),
  icons: {
    arrow: toQuickEstimateAssetPath("/assets/quick-estimate/arrow.svg"),
  },
} as const;
