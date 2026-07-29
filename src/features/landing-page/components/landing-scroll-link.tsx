"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

const SCROLL_DURATION_MS = 600;
const ACCELERATION_PORTION = 0.7;

let activeScrollFrameId: number | null = null;

type LandingScrollLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> & {
  href: `#${string}`;
};

/**
 * 전체 시간의 70% 동안 속도를 높이고 마지막 30% 동안 빠르게 줄인다.
 *
 * 가속과 감속 경계에서 속도가 끊기지 않도록 cosine과 sine 구간을 연결한다.
 */
function getAsymmetricScrollProgress(elapsedPortion: number) {
  const progress = Math.min(Math.max(elapsedPortion, 0), 1);

  if (progress <= ACCELERATION_PORTION) {
    const accelerationProgress = progress / ACCELERATION_PORTION;

    return ACCELERATION_PORTION * (1 - Math.cos((Math.PI / 2) * accelerationProgress));
  }

  const decelerationProgress = (progress - ACCELERATION_PORTION) / (1 - ACCELERATION_PORTION);

  return (
    ACCELERATION_PORTION +
    (1 - ACCELERATION_PORTION) * Math.sin((Math.PI / 2) * decelerationProgress)
  );
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
