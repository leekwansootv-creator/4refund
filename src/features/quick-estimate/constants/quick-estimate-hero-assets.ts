const quickEstimateHeroBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function toQuickEstimateHeroAssetPath(path: `/assets/quick-estimate/${string}`) {
  return `${quickEstimateHeroBasePath}${path}`;
}

/** 랜딩 hero가 합성하는 Figma 봉투·결과지·동전 에셋 경로입니다. */
export const QUICK_ESTIMATE_HERO_ASSETS = {
  envelope: {
    back: toQuickEstimateHeroAssetPath("/assets/quick-estimate/envelope-back.png"),
    paper: toQuickEstimateHeroAssetPath("/assets/quick-estimate/estimate-paper.png"),
    frontShadow: toQuickEstimateHeroAssetPath("/assets/quick-estimate/envelope-front-shadow.png"),
    front: toQuickEstimateHeroAssetPath("/assets/quick-estimate/envelope-front.png"),
  },
  coins: toQuickEstimateHeroAssetPath("/assets/quick-estimate/coins.png"),
} as const;
