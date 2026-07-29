"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

const SCROLL_DURATION_MS = 600;
const SCROLL_EASING_START_X = 0.3;
const SCROLL_EASING_END_X = 0.25;
const CUBIC_BEZIER_SEARCH_ITERATIONS = 16;

let activeScrollFrameId: number | null = null;

type LandingScrollLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> & {
  href: `#${string}`;
};

/**
 * 느리게 출발하되 150ms에 약 32%, 300ms에 약 77%를 이동한다.
 *
 * 시작과 끝의 속도를 0으로 유지하면서 Figma 프로토타입처럼 초반 이동량을 높인다.
 */
function getAsymmetricScrollProgress(elapsedPortion: number) {
  const progress = Math.min(Math.max(elapsedPortion, 0), 1);

  if (progress === 0 || progress === 1) {
    return progress;
  }

  let lowerParameter = 0;
  let upperParameter = 1;

  for (let iteration = 0; iteration < CUBIC_BEZIER_SEARCH_ITERATIONS; iteration += 1) {
    const parameter = (lowerParameter + upperParameter) / 2;
    const inverseParameter = 1 - parameter;
    const timeCoordinate =
      3 * inverseParameter ** 2 * parameter * SCROLL_EASING_START_X +
      3 * inverseParameter * parameter ** 2 * SCROLL_EASING_END_X +
      parameter ** 3;

    if (timeCoordinate < progress) {
      lowerParameter = parameter;
    } else {
      upperParameter = parameter;
    }
  }

  const parameter = (lowerParameter + upperParameter) / 2;

  return 3 * (1 - parameter) * parameter ** 2 + parameter ** 3;
}

function getTargetScrollTop(target: HTMLElement) {
  const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
  const targetTop = target.getBoundingClientRect().top + window.scrollY;
  const maximumScrollTop = Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

  return Math.min(Math.max(targetTop - headerHeight - 1, 0), maximumScrollTop);
}

function animateScrollTo(targetScrollTop: number) {
  if (activeScrollFrameId !== null) {
    window.cancelAnimationFrame(activeScrollFrameId);
  }

  const startScrollTop = window.scrollY;
  const scrollDistance = targetScrollTop - startScrollTop;
  const startTime = window.performance.now();

  const updateScroll = (currentTime: number) => {
    const elapsedPortion = (currentTime - startTime) / SCROLL_DURATION_MS;

    if (elapsedPortion >= 1) {
      window.scrollTo({ top: targetScrollTop, behavior: "auto" });
      activeScrollFrameId = null;
      return;
    }

    window.scrollTo({
      top: startScrollTop + scrollDistance * getAsymmetricScrollProgress(elapsedPortion),
      behavior: "auto",
    });
    activeScrollFrameId = window.requestAnimationFrame(updateScroll);
  };

  activeScrollFrameId = window.requestAnimationFrame(updateScroll);
}

/**
 * 랜딩 페이지 내부 앵커로 600ms 비대칭 가감속 스크롤을 제공한다.
 */
export function LandingScrollLink({ href, ...anchorProps }: LandingScrollLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = document.querySelector<HTMLElement>(href);

    if (!target) {
      return;
    }

    event.preventDefault();

    if (window.location.hash !== href) {
      window.history.pushState(null, "", href);
    }

    const targetScrollTop = getTargetScrollTop(target);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo({ top: targetScrollTop, behavior: "auto" });
      return;
    }

    animateScrollTo(targetScrollTop);
  };

  return <a {...anchorProps} href={href} onClick={handleClick} />;
}
