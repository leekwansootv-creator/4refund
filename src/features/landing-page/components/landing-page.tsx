import { BenefitsSection } from "./benefits-section";
import { CenterIntroductionSection } from "./center-introduction-section";
import { ContactSection } from "./contact-section";
import { ExpertStrengthsSection } from "./expert-strengths-section";
import { HeroSection } from "./hero-section";
import { LandingRevealController } from "./landing-reveal-controller";
import { RefundCasesSection } from "./refund-cases-section";
import { RefundProcessSection } from "./refund-process-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * 랜딩 페이지의 고정된 정보 구조와 section 순서를 조합한다.
 */
export function LandingPage() {
  return (
    <>
      <div id="top" aria-hidden="true" />
      <LandingRevealController />
      <SiteHeader />
      <main>
        <HeroSection />
        <CenterIntroductionSection />
        <BenefitsSection />
        <RefundCasesSection />
        <ExpertStrengthsSection />
        <RefundProcessSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
