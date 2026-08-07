import motionStyles from "./landing-motion.module.css";
import responsiveStyles from "./landing-responsive.module.css";
import { RefundCasesTrack } from "./refund-cases-track";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 업종별 익명 환급 사례를 자동 순환하며 터치 환경의 세로 페이지 스크롤을 보장한다.
 */
export function RefundCasesSection() {
  const { refundCases } = LANDING_CONTENT;

  return (
    <section
      aria-labelledby="refund-cases-heading"
      className={`${responsiveStyles.refundCasesSection} ${motionStyles.timeline} flex h-[859px] flex-col py-[140px]`}
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <div className="flex flex-col items-center gap-3 text-center leading-[1.2]">
          <h2
            id="refund-cases-heading"
            className={`${responsiveStyles.refundCasesHeading} text-5xl leading-[1.2] font-bold text-black`}
          >
            {refundCases.heading}
          </h2>
          <p
            className={`${responsiveStyles.refundCasesDescription} text-xl leading-[1.2] text-black`}
          >
            {refundCases.description}
          </p>
        </div>
      </div>

      <RefundCasesTrack />
    </section>
  );
}
