import Image from "next/image";

import motionStyles from "./landing-motion.module.css";
import responsiveStyles from "./landing-responsive.module.css";
import styles from "./landing-services-cases.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

type RefundCase = (typeof LANDING_CONTENT.refundCases.items)[number];
type RefundCasesTrackVariant = "hero" | "section";

function RefundCaseCard({
  refundCase,
  variant,
}: {
  refundCase: RefundCase;
  variant: RefundCasesTrackVariant;
}) {
  const isHero = variant === "hero";

  return (
    <li
      className={`${
        isHero
          ? `${responsiveStyles.heroRefundCaseCard} h-[184.475px] w-[458.35px]`
          : `${responsiveStyles.refundCaseCard} h-[416px] w-[646px]`
      } relative flex shrink-0 items-center justify-center overflow-hidden rounded-3xl text-center text-white`}
    >
      <Image
        src={LANDING_ASSETS.images.refundCases[refundCase.assetKey]}
        alt=""
        fill
        sizes={isHero ? "458px" : "646px"}
        className="object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/20" />

      <div
        className={`relative flex flex-col items-center ${isHero ? "gap-[13px]" : "gap-[18px]"}`}
      >
        <div className="flex flex-col items-center gap-1 leading-[1.2]">
          <h3
            className={`${
              isHero
                ? `${responsiveStyles.heroRefundCaseTitle} text-[23px]`
                : `${responsiveStyles.refundCaseTitle} text-[32px]`
            } font-bold whitespace-nowrap`}
          >
            {refundCase.industry}
          </h3>
          <p className={isHero ? "text-[17px]" : "w-[113px] text-2xl"}>{refundCase.company}</p>
        </div>
        <div
          className={`${
            isHero
              ? `${responsiveStyles.heroRefundCapsule} gap-[9px] px-[17px] py-[11px] backdrop-blur-[19px]`
              : `${responsiveStyles.refundCapsule} gap-3 px-6 py-[15px] backdrop-blur-[26px]`
          } flex items-center justify-center rounded-[100px] border border-white/50 ${styles.refundCapsule}`}
        >
          <span
            className={`${
              isHero ? "px-[14px] py-[7px] text-[14px]" : "px-5 py-2.5 text-xl"
            } rounded-[130px] bg-black/40 leading-[1.2] font-bold whitespace-nowrap`}
          >
            환급 총액
          </span>
          <strong
            className={`${
              isHero
                ? `${responsiveStyles.heroRefundAmount} text-xl`
                : `${responsiveStyles.refundAmount} text-[28px]`
            } leading-[1.2] font-bold whitespace-nowrap`}
          >
            {refundCase.amount}
          </strong>
        </div>
      </div>
    </li>
  );
}

/**
 * 익명 환급 사례를 지정된 랜딩 배치 크기로 자동 순환합니다.
 *
 * 독립 section은 끊김 없는 순환을 위해 목록을 복제하고, hero variant는
 * Figma timeline과 같은 단일 8개 목록의 절반 이동을 사용합니다.
 */
export function RefundCasesTrack({ variant = "section" }: { variant?: RefundCasesTrackVariant }) {
  const refundCases = LANDING_CONTENT.refundCases.items;
  const isHero = variant === "hero";

  return (
    <div
      role="region"
      aria-label="환급 사례 자동 이동 목록"
      tabIndex={0}
      className={`${
        isHero ? styles.heroRefundCasesViewport : "mt-[38px]"
      } w-full overflow-x-auto overscroll-x-contain focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--color-brand-primary)] ${styles.refundCasesViewport} ${motionStyles.refundCasesViewport}`}
    >
      <div
        className={`${
          isHero
            ? `${responsiveStyles.heroRefundCasesTrack} ${motionStyles.heroRefundCasesTrack} gap-[17.028px] px-[18px]`
            : `${responsiveStyles.refundCasesTrack} ${motionStyles.refundCasesTrack} gap-6 px-6`
        } flex w-max`}
      >
        <ul className={`flex w-max ${isHero ? "gap-[17.028px]" : "gap-6"}`}>
          {refundCases.map((refundCase) => (
            <RefundCaseCard
              key={`${variant}-${refundCase.company}-${refundCase.amount}`}
              refundCase={refundCase}
              variant={variant}
            />
          ))}
        </ul>
        {isHero ? null : (
          <ul aria-hidden="true" className="flex w-max gap-6">
            {refundCases.map((refundCase) => (
              <RefundCaseCard
                key={`duplicate-${refundCase.company}-${refundCase.amount}`}
                refundCase={refundCase}
                variant={variant}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
