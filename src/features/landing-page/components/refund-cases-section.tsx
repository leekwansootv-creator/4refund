import Image from "next/image";

import responsiveStyles from "./landing-responsive.module.css";
import styles from "./landing-services-cases.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 업종별 익명 환급 사례를 해당 목록 안에서만 가로로 탐색할 수 있게 제공한다.
 */
export function RefundCasesSection() {
  const { refundCases } = LANDING_CONTENT;

  return (
    <section
      aria-labelledby="refund-cases-heading"
      className={`${responsiveStyles.refundCasesSection} flex h-[859px] flex-col py-[140px]`}
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

      <div
        className={`mt-[38px] w-full overflow-x-auto overscroll-x-contain ${styles.refundCasesViewport}`}
      >
        <ul className={`${responsiveStyles.refundCasesTrack} flex w-max gap-6 px-6`}>
          {refundCases.items.map((refundCase) => (
            <li
              key={`${refundCase.company}-${refundCase.amount}`}
              className={`${responsiveStyles.refundCaseCard} relative flex h-[416px] w-[646px] shrink-0 items-center justify-center overflow-hidden rounded-3xl text-center text-white`}
            >
              <Image
                src={LANDING_ASSETS.images.refundCases[refundCase.assetKey]}
                alt=""
                fill
                sizes="646px"
                className="object-cover"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-black/20" />

              <div className="relative flex flex-col items-center gap-[18px]">
                <div className="flex flex-col items-center gap-1 leading-[1.2]">
                  <h3
                    className={`${responsiveStyles.refundCaseTitle} text-[32px] font-bold whitespace-nowrap`}
                  >
                    {refundCase.industry}
                  </h3>
                  <p className="w-[113px] text-2xl">{refundCase.company}</p>
                </div>
                <div
                  className={`${responsiveStyles.refundCapsule} flex items-center justify-center gap-3 rounded-[100px] border border-white/50 px-6 py-[15px] backdrop-blur-[26px] ${styles.refundCapsule}`}
                >
                  <span className="rounded-[130px] bg-black/40 px-5 py-2.5 text-xl leading-[1.2] font-bold whitespace-nowrap">
                    환급 총액
                  </span>
                  <strong
                    className={`${responsiveStyles.refundAmount} text-[28px] leading-[1.2] font-bold whitespace-nowrap`}
                  >
                    {refundCase.amount}
                  </strong>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
