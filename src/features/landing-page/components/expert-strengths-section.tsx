import Image from "next/image";

import styles from "./landing-expert-strengths.module.css";
import motionStyles from "./landing-motion.module.css";
import responsiveStyles from "./landing-responsive.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

const strengthImageFrameClasses = {
  remoteConsultation: "w-[662px]",
  rpaAi: "w-[526px]",
  security: "w-[540px]",
} as const;

const strengthImageClasses = {
  remoteConsultation: styles.remoteConsultationArtwork,
  rpaAi: styles.automationArtwork,
  security: styles.securityArtwork,
} as const;

/**
 * 사용자가 승인한 비대면 상담, RPA·AI 분석, 정보 보안 소개를 표시한다.
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
        className={`${responsiveStyles.expertIntroduction} flex min-h-[753px] items-center bg-[#f3f7fe] py-[140px]`}
      >
        <div
          className={`${responsiveStyles.expertIntroductionInner} mx-auto flex w-full max-w-[var(--content-max-width)] items-center justify-between px-[var(--content-inline-padding)]`}
        >
          <div
            data-landing-reveal="left"
            data-landing-reveal-repeat="true"
            className={`${responsiveStyles.expertIntroductionCopy} ${motionStyles.revealFromLeft} flex w-[804px] min-w-0 flex-col items-start gap-10`}
          >
            <div className="flex flex-col items-start gap-6">
              <p
                className={`${responsiveStyles.expertEyebrow} text-[28px] leading-[1.3] font-medium text-[#486db2]`}
              >
                {expertStrengths.eyebrow}
              </p>
              <h2
                id="expert-strengths-heading"
                className={`${responsiveStyles.expertHeading} text-[64px] leading-[1.2] font-extrabold text-[var(--color-brand-navy)]`}
              >
                {expertStrengths.heading}
              </h2>
            </div>

            <ul className={`${responsiveStyles.expertPills} flex items-start gap-3`}>
              {expertStrengths.items.map((strength) => (
                <li
                  key={strength.id}
                  className={`${responsiveStyles.expertPill} flex min-w-0 flex-col items-start gap-1 rounded-lg bg-white px-4 py-3`}
                >
                  <div className="flex items-center gap-2">
                    <Image
                      src={LANDING_ASSETS.icons[strength.iconKey]}
                      alt=""
                      width={24}
                      height={24}
                      unoptimized
                      className="size-6"
                    />
                    <span
                      className={`${responsiveStyles.expertPillText} text-lg leading-[1.4] font-medium text-[#101010]`}
                    >
                      {"cardTitle" in strength ? strength.cardTitle : strength.title}
                    </span>
                  </div>
                  <p className="text-sm leading-[1.6] text-[#1b264e]">{strength.summary}</p>
                </li>
              ))}
            </ul>

            <p
              className={`${responsiveStyles.expertDescription} w-full max-w-[609px] text-2xl leading-[1.6] font-normal text-[#1b264e]`}
            >
              {expertStrengths.description}
            </p>
          </div>

          <figure
            data-landing-reveal="right"
            data-landing-reveal-repeat="true"
            data-landing-reveal-followup="true"
            data-landing-reveal-followup-source="true"
            className={`${responsiveStyles.expertIntroductionFigure} ${motionStyles.revealFromRight} flex w-[282px] shrink-0 flex-col items-center gap-3`}
          >
            <div
              data-landing-reveal-followup-target="true"
              className={`${motionStyles.strengthFigure} relative h-[413px] w-full overflow-hidden`}
            >
              <Image
                src={LANDING_ASSETS.images.expertStrengths.introduction}
                alt=""
                width={1312}
                height={1199}
                unoptimized
                className={styles.introductionArtwork}
              />
            </div>
            <figcaption className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-lg leading-none font-medium">
              <Image src={LANDING_ASSETS.icons.patentAward} alt="" width={24} height={24} />
              {expertStrengths.patentLabel}
            </figcaption>
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
                  } flex w-[506px] min-w-0 shrink-0 flex-col gap-12 ${
                    isImageLeft ? "order-2 items-end text-right" : "order-1 items-start text-left"
                  }`}
                >
                  <h3
                    id={`strength-${strength.id}`}
                    className={`${responsiveStyles.strengthTitle} flex flex-col gap-6 text-[32px] leading-[1.4] font-extrabold text-[var(--color-brand-navy)]`}
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
                    className={`${responsiveStyles.strengthDescription} text-2xl leading-[1.6] font-medium whitespace-pre-line text-[#6b6b6b] ${
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
                      width={strength.assetKey === "rpaAi" ? 1337 : 1152}
                      height={strength.assetKey === "rpaAi" ? 1176 : 928}
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
