import Image from "next/image";

import styles from "./landing-expert-strengths.module.css";
import motionStyles from "./landing-motion.module.css";
import responsiveStyles from "./landing-responsive.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

const strengthImageFrameClasses = {
  remoteConsultation: "w-[662px]",
  successFee: "w-[526px]",
  security: "w-[540px]",
} as const;

const strengthImageClasses = {
  remoteConsultation: styles.remoteConsultationArtwork,
  successFee: styles.successFeeArtwork,
  security: styles.securityArtwork,
} as const;

/**
 * 상담 범위, 수수료, 정보 보안에 관한 전문가 강점을 설명한다.
 */
export function ExpertStrengthsSection() {
  const { expertStrengths } = LANDING_CONTENT;

  return (
    <section
      id="strengths"
      aria-labelledby="expert-strengths-heading"
      className={`${styles.root} ${motionStyles.timeline} ${motionStyles.horizontalClip} bg-white`}
    >
      <div
        className={`${responsiveStyles.expertIntroduction} flex h-[801px] items-start bg-[#f3f7fe] pt-[140px] pb-[148px]`}
      >
        <div
          className={`${responsiveStyles.expertIntroductionInner} mx-auto flex w-full max-w-[var(--content-max-width)] items-center justify-between px-[var(--content-inline-padding)]`}
        >
          <div
            data-landing-reveal="left"
            data-landing-reveal-repeat="true"
            className={`${responsiveStyles.expertIntroductionCopy} ${motionStyles.revealFromLeft} flex h-[513px] w-[766px] shrink-0 flex-col items-start gap-20`}
          >
            <div className="flex flex-col items-start gap-6">
              <p
                className={`${responsiveStyles.expertEyebrow} text-[32px] leading-none font-medium text-[#486db2]`}
              >
                {expertStrengths.eyebrow}
              </p>
              <h2
                id="expert-strengths-heading"
                className={`${responsiveStyles.expertHeading} text-[96px] leading-none font-extrabold whitespace-nowrap text-[var(--color-brand-navy)]`}
              >
                {expertStrengths.heading}
              </h2>
            </div>

            <ul className={`${responsiveStyles.expertPills} flex items-start gap-3`}>
              {expertStrengths.items.map((strength) => (
                <li
                  key={strength.id}
                  className={`${responsiveStyles.expertPill} flex items-center gap-[13px] rounded-[30px] bg-white px-4 py-3`}
                >
                  <Image
                    src={LANDING_ASSETS.icons[strength.iconKey]}
                    alt=""
                    width={24}
                    height={24}
                    unoptimized
                    className="size-6"
                  />
                  <span
                    className={`${responsiveStyles.expertPillText} text-xl leading-none font-medium whitespace-nowrap text-[#101010]`}
                  >
                    {strength.title}
                  </span>
                </li>
              ))}
            </ul>

            <p
              className={`${responsiveStyles.expertDescription} w-[609px] text-[32px] leading-[1.6] font-normal whitespace-pre-line text-[#1b264e]`}
            >
              {expertStrengths.description}
            </p>
          </div>

          <figure
            aria-hidden="true"
            data-landing-reveal="right"
            data-landing-reveal-repeat="true"
            className={`${responsiveStyles.expertIntroductionFigure} ${motionStyles.revealFromRight} relative h-[501px] w-[424px] shrink-0 overflow-hidden`}
          >
            <Image
              src={LANDING_ASSETS.images.expertStrengths.introduction}
              alt=""
              width={1264}
              height={728}
              unoptimized
              className={styles.introductionArtwork}
            />
          </figure>
        </div>
      </div>

      <ol>
        {expertStrengths.items.map((strength) => {
          const isImageLeft = strength.layout === "image-left";

          return (
            <li
              key={strength.id}
              className={`${responsiveStyles.strengthRow} flex h-[736px] items-center ${
                isImageLeft ? "bg-white" : "bg-[#f3f7fe]"
              }`}
            >
              <article
                aria-labelledby={`strength-${strength.id}`}
                data-landing-reveal="group"
                data-landing-reveal-repeat="true"
                data-landing-reveal-followup="true"
                className={`${responsiveStyles.strengthArticle} ${motionStyles.revealGroup} mx-auto flex h-[456px] w-full max-w-[var(--content-max-width)] items-center justify-between px-[var(--content-inline-padding)]`}
              >
                <div
                  className={`${responsiveStyles.strengthCopy} ${
                    isImageLeft ? motionStyles.revealFromRight : motionStyles.revealFromLeft
                  } flex h-[345px] w-[506px] shrink-0 flex-col gap-12 ${
                    isImageLeft ? "order-2 items-end text-right" : "order-1 items-start text-left"
                  }`}
                >
                  <h3
                    id={`strength-${strength.id}`}
                    className={`${responsiveStyles.strengthTitle} flex flex-col gap-12 text-5xl leading-none font-extrabold whitespace-nowrap text-[var(--color-brand-navy)]`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${responsiveStyles.strengthStep} flex items-center gap-6 text-5xl leading-none font-medium text-[#5f8fd6] ${
                        isImageLeft ? "justify-end" : "justify-start"
                      }`}
                    >
                      {isImageLeft ? <span className="h-px w-[50px] bg-[#a8ccff]" /> : null}
                      {strength.step}
                      {isImageLeft ? null : <span className="h-px w-[50px] bg-[#a8ccff]" />}
                    </span>
                    <span>{strength.title}</span>
                  </h3>

                  <p
                    className={`${responsiveStyles.strengthDescription} text-[32px] leading-[1.6] font-medium whitespace-pre-line text-[#878787] ${
                      strength.id === "remote-consultation" ? "w-[406px]" : "w-full"
                    }`}
                  >
                    {strength.description}
                  </p>
                </div>

                <figure
                  aria-hidden="true"
                  data-landing-reveal-followup-source="true"
                  className={`${responsiveStyles.strengthFigure} ${
                    isImageLeft ? motionStyles.revealFromLeft : motionStyles.revealFromRight
                  } relative h-[456px] shrink-0 ${
                    isImageLeft ? "order-1" : "order-2"
                  } ${strengthImageFrameClasses[strength.assetKey]}`}
                >
                  <div
                    data-landing-reveal-followup-target="true"
                    className={`${motionStyles.strengthFigure} relative size-full overflow-hidden`}
                  >
                    <Image
                      src={LANDING_ASSETS.images.expertStrengths[strength.assetKey]}
                      alt=""
                      width={1152}
                      height={strength.assetKey === "successFee" ? 998 : 928}
                      unoptimized
                      className={strengthImageClasses[strength.assetKey]}
                    />
                  </div>
                </figure>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
