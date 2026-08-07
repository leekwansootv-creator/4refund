import type { ReactNode } from "react";

import { BenefitsSection } from "./benefits-section";
import { CenterIntroductionSection } from "./center-introduction-section";
import { ContactSection } from "./contact-section";
import { ExpertStrengthsSection } from "./expert-strengths-section";
import { LandingRevealController } from "./landing-reveal-controller";
import { QuickEstimateHeroSection } from "./quick-estimate-hero-section";
import { RefundProcessSection } from "./refund-process-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * 랜딩 페이지의 고정된 정보 구조와 section 순서를 조합한다.
 */
export function LandingPage({ quickEstimateAction }: { quickEstimateAction: ReactNode }) {
  return (
    <>
      <div id="top" aria-hidden="true" />
      <LandingRevealController />
      <SiteHeader />
      <main>
        <QuickEstimateHeroSection action={quickEstimateAction} />
        <CenterIntroductionSection />
        <BenefitsSection />
        <ExpertStrengthsSection />
        <RefundProcessSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
