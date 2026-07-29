"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = "[data-landing-reveal]";
const REVEALED_ATTRIBUTE = "data-landing-revealed";
const INSTANT_REVEAL_ATTRIBUTE = "data-landing-reveal-instant";
const REPEAT_REVEAL_ATTRIBUTE = "data-landing-reveal-repeat";
const FOLLOWUP_TRIGGER_ATTRIBUTE = "data-landing-reveal-followup";
const FOLLOWUP_TARGET_SELECTOR = "[data-landing-reveal-followup-target]";
const FOLLOWUP_SOURCE_ATTRIBUTE = "data-landing-reveal-followup-source";
const FOLLOWUP_ACTIVE_ATTRIBUTE = "data-landing-reveal-followup-active";
const MOTION_READY_ATTRIBUTE = "data-landing-motion-ready";
const REVEAL_THRESHOLD = 0.25;

/**
 * 대상의 25%가 보일 때 진입 모션을 시작하고 반복 대상은 화면 이탈 후 재준비한다.
 */
export function LandingRevealController() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const setFollowupActive = (target: HTMLElement, isActive: boolean) => {
      const followupTarget =
        target.closest("article")?.querySelector<HTMLElement>(FOLLOWUP_TARGET_SELECTOR) ?? null;

      if (!followupTarget) {
        return;
      }

      if (isActive) {
        followupTarget.setAttribute(FOLLOWUP_ACTIVE_ATTRIBUTE, "true");
        return;
      }

      followupTarget.removeAttribute(FOLLOWUP_ACTIVE_ATTRIBUTE);
    };

    const handleRevealTransitionEnd = (event: TransitionEvent) => {
      const target = event.currentTarget as HTMLElement;
      const transitionTarget = event.target as HTMLElement;

      if (
        !transitionTarget.hasAttribute(FOLLOWUP_SOURCE_ATTRIBUTE) ||
        event.propertyName !== "transform" ||
        !target.hasAttribute(REVEALED_ATTRIBUTE)
      ) {
        return;
      }

      setFollowupActive(target, true);
    };

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
          const target = entry.target as HTMLElement;
          const shouldRepeat = target.hasAttribute(REPEAT_REVEAL_ATTRIBUTE);

          if (entry.isIntersecting && entry.intersectionRatio >= REVEAL_THRESHOLD) {
            if (!isScrollingDown && !shouldRepeat) {
              target.setAttribute(INSTANT_REVEAL_ATTRIBUTE, "true");
            }

            if (shouldRepeat) {
              target.removeAttribute(INSTANT_REVEAL_ATTRIBUTE);
              setFollowupActive(target, false);
            }

            target.setAttribute(REVEALED_ATTRIBUTE, "true");

            if (!shouldRepeat) {
              observer.unobserve(target);
            }
          } else if (!entry.isIntersecting && shouldRepeat) {
            setFollowupActive(target, false);
            target.removeAttribute(INSTANT_REVEAL_ATTRIBUTE);
            target.removeAttribute(REVEALED_ATTRIBUTE);
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

    for (const target of targets) {
      if (target.hasAttribute(FOLLOWUP_TRIGGER_ATTRIBUTE)) {
        target.addEventListener("transitionend", handleRevealTransitionEnd);
      }
    }

    const hashTarget = document.getElementById(window.location.hash.slice(1));

    for (const target of targets) {
      if (hashTarget?.contains(target)) {
        target.setAttribute(INSTANT_REVEAL_ATTRIBUTE, "true");
        target.setAttribute(REVEALED_ATTRIBUTE, "true");

        if (!target.hasAttribute(REPEAT_REVEAL_ATTRIBUTE)) {
          continue;
        }
      }

      observer.observe(target);
    }

    return () => {
      observer.disconnect();
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);

      for (const target of targets) {
        target.removeEventListener("transitionend", handleRevealTransitionEnd);
      }

      document.documentElement.removeAttribute(MOTION_READY_ATTRIBUTE);
    };
  }, []);

  return null;
}
