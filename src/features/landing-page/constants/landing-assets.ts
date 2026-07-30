const landingBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function toLandingAssetPath(path: `/assets/landing/${string}`) {
  return `${landingBasePath}${path}`;
}

/**
 * Figma 원본에서 추출한 랜딩 페이지 정적 에셋 경로다.
 */
export const LANDING_ASSETS = {
  icons: {
    logo: toLandingAssetPath("/assets/landing/icons/logo.svg"),
    phone: toLandingAssetPath("/assets/landing/icons/phone.svg"),
    chat: toLandingAssetPath("/assets/landing/icons/chat.svg"),
    email: toLandingAssetPath("/assets/landing/icons/email.svg"),
    more: toLandingAssetPath("/assets/landing/icons/more.svg"),
    globe: toLandingAssetPath("/assets/landing/icons/globe.svg"),
    percent: toLandingAssetPath("/assets/landing/icons/percent.svg"),
    lock: toLandingAssetPath("/assets/landing/icons/lock.svg"),
    arrowUpRight: toLandingAssetPath("/assets/landing/icons/arrow-up-right.svg"),
    location: toLandingAssetPath("/assets/landing/icons/location.svg"),
  },
  images: {
    hero: toLandingAssetPath("/assets/landing/images/hero-refund-desk.png"),
    centerBackground: toLandingAssetPath(
      "/assets/landing/images/center-introduction-background.png",
    ),
    centerMemberPlaceholder: toLandingAssetPath(
      "/assets/landing/images/center-member-placeholder.svg",
    ),
    centerDirector: toLandingAssetPath("/assets/landing/images/center-director.png"),
    benefits: {
      hiddenPremium: toLandingAssetPath("/assets/landing/images/benefit-hidden-premium.png"),
      laborAttorneyReview: toLandingAssetPath(
        "/assets/landing/images/benefit-labor-attorney-review.png",
      ),
      maximumRefund: toLandingAssetPath("/assets/landing/images/benefit-maximum-refund.png"),
      aftercare: toLandingAssetPath("/assets/landing/images/benefit-aftercare.png"),
    },
    refundCases: {
      office: toLandingAssetPath("/assets/landing/images/refund-case-office.png"),
      construction: toLandingAssetPath("/assets/landing/images/refund-case-construction.png"),
      service: toLandingAssetPath("/assets/landing/images/refund-case-service.png"),
      records: toLandingAssetPath("/assets/landing/images/refund-case-records.png"),
    },
    expertStrengths: {
      introduction: toLandingAssetPath("/assets/landing/images/expert-introduction.png"),
      remoteConsultation: toLandingAssetPath(
        "/assets/landing/images/expert-remote-consultation.png",
      ),
      successFee: toLandingAssetPath("/assets/landing/images/expert-success-fee.png"),
      security: toLandingAssetPath("/assets/landing/images/expert-security.png"),
    },
    refundProcess: {
      background: toLandingAssetPath("/assets/landing/images/process-background.png"),
      consultation: toLandingAssetPath("/assets/landing/images/process-consultation.png"),
      analysis: toLandingAssetPath("/assets/landing/images/process-analysis.png"),
      documents: toLandingAssetPath("/assets/landing/images/process-documents.png"),
      refundComplete: toLandingAssetPath("/assets/landing/images/process-refund-complete.png"),
    },
  },
} as const;
