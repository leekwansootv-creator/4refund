"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = "[data-landing-reveal]";
const REVEALED_ATTRIBUTE = "data-landing-revealed";
const INSTANT_REVEAL_ATTRIBUTE = "data-landing-reveal-instant";
const MOTION_READY_ATTRIBUTE = "data-landing-motion-ready";
const REVEAL_THRESHOLD = 0.25;

/**
 * 아래 방향 스크롤로 대상의 25%가 보일 때 진입 모션을 페이지당 한 번만 시작한다.
 */
export function LandingRevealController() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const revealAll = () => {
      for (const target of targets) {
        target.setAttribute(INSTANT_REVEAL_ATTRIBUTE, "true");
        target.setAttribute(REVEALED_ATTRIBUTE, "true");
      }
    };

    if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    let previousObservedScrollY = window.scrollY;

    const observer = new IntersectionObserver(
      (entries) => {
        const currentScrollY = window.scrollY;
        const isScrollingDown = currentScrollY >= previousObservedScrollY;
        previousObservedScrollY = currentScrollY;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= REVEAL_THRESHOLD) {
            const target = entry.target as HTMLElement;

            if (!isScrollingDown) {
              target.setAttribute(INSTANT_REVEAL_ATTRIBUTE, "true");
            }

            target.setAttribute(REVEALED_ATTRIBUTE, "true");
            observer.unobserve(target);
          }
        }
      },
      { threshold: [0, REVEAL_THRESHOLD] },
    );

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        document.documentElement.removeAttribute(MOTION_READY_ATTRIBUTE);
        revealAll();
        observer.disconnect();
      }
    };

    document.documentElement.setAttribute(MOTION_READY_ATTRIBUTE, "true");
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    const hashTarget = document.getElementById(window.location.hash.slice(1));

    for (const target of targets) {
      if (hashTarget?.contains(target)) {
        target.setAttribute(INSTANT_REVEAL_ATTRIBUTE, "true");
        target.setAttribute(REVEALED_ATTRIBUTE, "true");
        continue;
      }

      observer.observe(target);
    }

    return () => {
      observer.disconnect();
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      document.documentElement.removeAttribute(MOTION_READY_ATTRIBUTE);
    };
  }, []);

  return null;
}
