"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import motionStyles from "./landing-motion.module.css";
import responsiveStyles from "./landing-responsive.module.css";
import styles from "./landing-services-cases.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

const BENEFIT_AUTOPLAY_INTERVAL_MS = 1600;
const BENEFIT_VISIBILITY_THRESHOLD = 0.25;

/**
 * 센터의 네 가지 서비스 혜택을 자동 순환하고 마우스, 키보드, 터치 선택을 제공한다.
 */
export function BenefitsSection() {
  const { benefits, brandName } = LANDING_CONTENT;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [autoplayVersion, setAutoplayVersion] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSectionInView, setIsSectionInView] = useState(false);
  const [isMotionReady, setIsMotionReady] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollDirectionRef = useRef<"up" | "down">("down");
  const entranceArmedRef = useRef(true);
  const remainingDelayRef = useRef(BENEFIT_AUTOPLAY_INTERVAL_MS);
  const deadlineRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndex = hoveredIndex ?? focusedIndex ?? selectedIndex;
  const isAutoplayPaused =
    prefersReducedMotion || !isSectionInView || hoveredIndex !== null || focusedIndex !== null;

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setPrefersReducedMotion(reducedMotionQuery.matches);

    updateReducedMotion();
    reducedMotionQuery.addEventListener("change", updateReducedMotion);

    return () => reducedMotionQuery.removeEventListener("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
      return;
    }

    if (prefersReducedMotion) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      const fallbackFrameId = globalThis.requestAnimationFrame(() => {
        setIsMotionReady(false);
        setHasEntered(true);
        setIsSectionInView(true);
      });

      return () => globalThis.cancelAnimationFrame(fallbackFrameId);
    }

    let previousScrollY = window.scrollY;

    const updateScrollDirection = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY !== previousScrollY) {
        scrollDirectionRef.current = currentScrollY < previousScrollY ? "up" : "down";
        previousScrollY = currentScrollY;
      }
    };

    entranceArmedRef.current = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        const isVisibleEnough =
          entry.isIntersecting && entry.intersectionRatio >= BENEFIT_VISIBILITY_THRESHOLD;

        setIsMotionReady(true);
        setIsSectionInView(isVisibleEnough);

        if (isVisibleEnough && entranceArmedRef.current) {
          entranceArmedRef.current = false;
          remainingDelayRef.current = BENEFIT_AUTOPLAY_INTERVAL_MS;
          setSelectedIndex(0);
          setAutoplayVersion((currentVersion) => currentVersion + 1);
          setHasEntered(true);
          return;
        }

        const viewportBottom = entry.rootBounds?.bottom ?? window.innerHeight;
        const leftViewportBelowWhileScrollingUp =
          !entry.isIntersecting &&
          scrollDirectionRef.current === "up" &&
          entry.boundingClientRect.top >= viewportBottom;

        if (!entry.isIntersecting && entranceArmedRef.current) {
          setHasEntered(false);
        }

        // 아래로 진행하며 지나간 경우에는 재진입 모션을 다시 준비하지 않는다.
        if (leftViewportBelowWhileScrollingUp) {
          entranceArmedRef.current = true;
          setHasEntered(false);
        }
      },
      { threshold: [0, BENEFIT_VISIBILITY_THRESHOLD] },
    );

    window.addEventListener("scroll", updateScrollDirection, { passive: true });
    observer.observe(section);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateScrollDirection);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (isAutoplayPaused) {
      return;
    }

    const delay = Math.max(remainingDelayRef.current, 0);
    deadlineRef.current = performance.now() + delay;
    const timeoutId = setTimeout(() => {
      timeoutRef.current = null;
      deadlineRef.current = 0;
      remainingDelayRef.current = BENEFIT_AUTOPLAY_INTERVAL_MS;
      setSelectedIndex((currentIndex) => (currentIndex + 1) % benefits.items.length);
    }, delay);
    timeoutRef.current = timeoutId;

    return () => {
      if (timeoutRef.current === timeoutId) {
        clearTimeout(timeoutId);
        timeoutRef.current = null;
        remainingDelayRef.current = Math.max(deadlineRef.current - performance.now(), 0);
        deadlineRef.current = 0;
      }
    };
  }, [autoplayVersion, benefits.items.length, isAutoplayPaused, selectedIndex]);

  const selectBenefit = (index: number) => {
    remainingDelayRef.current = BENEFIT_AUTOPLAY_INTERVAL_MS;
    setSelectedIndex(index);
    setAutoplayVersion((currentVersion) => currentVersion + 1);
  };

  return (
    <section
      ref={sectionRef}
      id="services"
      aria-labelledby="benefits-heading"
      className={`${responsiveStyles.benefitsSection} ${motionStyles.timeline} h-[791px] py-[140px]`}
    >
      <div
        data-benefits-motion-ready={isMotionReady && !prefersReducedMotion ? "true" : undefined}
        data-benefits-entered={hasEntered ? "true" : "false"}
        className={`${responsiveStyles.benefitsContainer} ${motionStyles.benefitsEntrance} mx-auto flex h-[511px] w-full max-w-[var(--content-max-width)] flex-col items-center gap-16 px-[var(--content-inline-padding)]`}
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
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") {
                    setHoveredIndex(index);
                    setSelectedIndex(index);
                  }
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") {
                    remainingDelayRef.current = BENEFIT_AUTOPLAY_INTERVAL_MS;
                    setHoveredIndex(null);
                    setAutoplayVersion((currentVersion) => currentVersion + 1);
                  }
                }}
              >
                <h3 className="w-full">
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isActive}
                    aria-controls={panelId}
                    className={`${responsiveStyles.interactiveControl} ${responsiveStyles.benefitButton}`}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    onClick={() => selectBenefit(index)}
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
