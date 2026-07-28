"use client";

import Image from "next/image";
import { useState } from "react";

import motionStyles from "./landing-motion.module.css";
import responsiveStyles from "./landing-responsive.module.css";
import styles from "./landing-services-cases.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 센터의 네 가지 서비스 혜택을 마우스, 키보드, 터치로 선택할 수 있게 제공한다.
 */
export function BenefitsSection() {
  const { benefits, brandName } = LANDING_CONTENT;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const activeIndex = focusedIndex ?? hoveredIndex ?? selectedIndex;

  return (
    <section
      id="services"
      aria-labelledby="benefits-heading"
      className={`${responsiveStyles.benefitsSection} ${motionStyles.timeline} ${motionStyles.revealUp} h-[791px] py-[140px]`}
    >
      <div
        className={`${responsiveStyles.benefitsContainer} mx-auto flex h-[511px] w-full max-w-[var(--content-max-width)] flex-col items-center gap-16 px-[var(--content-inline-padding)]`}
      >
        <div
          className={`${responsiveStyles.benefitsHeadingGroup} flex h-[141px] w-[532px] flex-col items-center gap-2 text-center`}
        >
          <h2
            id="benefits-heading"
            className={`${responsiveStyles.benefitsHeading} text-[42px] leading-[1.3] font-bold tracking-[-0.6px] text-[#141719]`}
          >
            왜 <span className={styles.benefitsBrand}>{brandName}</span>에서
            <br />
            환급받아야 할까요?
          </h2>
          <p
            className={`${responsiveStyles.benefitsDescription} text-lg leading-[1.3] font-medium whitespace-nowrap text-[#2b2b2b]`}
          >
            {benefits.description}
          </p>
        </div>

        <ul
          className={`${responsiveStyles.benefitsList} grid h-[306px] w-full grid-cols-4 items-start gap-4`}
        >
          {benefits.items.map((benefit, index) => {
            const isActive = index === activeIndex;
            const buttonId = `benefit-button-${index}`;
            const panelId = `benefit-panel-${index}`;

            return (
              <li
                key={benefit.title}
                className={`${responsiveStyles.benefitItem} flex min-w-0 flex-col items-center text-center`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <h3 className="w-full">
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isActive}
                    aria-controls={panelId}
                    className={responsiveStyles.benefitButton}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <span
                      className={`${responsiveStyles.benefitImage} ${
                        isActive
                          ? responsiveStyles.benefitImageActive
                          : responsiveStyles.benefitImageInactive
                      }`}
                    >
                      <Image
                        src={LANDING_ASSETS.images.benefits[benefit.assetKey]}
                        alt=""
                        fill
                        unoptimized
                        sizes={isActive ? "199px" : "133px"}
                        className="object-contain"
                      />
                    </span>

                    <span
                      className={`${responsiveStyles.benefitTitle} ${
                        isActive
                          ? responsiveStyles.benefitTitleActive
                          : responsiveStyles.benefitTitleInactive
                      }`}
                    >
                      {benefit.title}
                      <span
                        aria-hidden="true"
                        className={`${responsiveStyles.benefitDot} ${
                          isActive
                            ? responsiveStyles.benefitDotActive
                            : responsiveStyles.benefitDotInactive
                        } mb-0.5 size-2 rounded-full bg-[#006dd2]`}
                      />
                    </span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isActive}
                  className={`${responsiveStyles.benefitPanel} ${
                    isActive
                      ? responsiveStyles.benefitPanelActive
                      : responsiveStyles.benefitPanelInactive
                  }`}
                >
                  <p
                    className={`${responsiveStyles.benefitPanelText} w-[374px] text-xl leading-[1.6] font-medium whitespace-pre-line text-[#141719]`}
                  >
                    {benefit.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
