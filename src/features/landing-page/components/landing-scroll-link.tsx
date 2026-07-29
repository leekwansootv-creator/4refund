"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

const SCROLL_DURATION_MS = 600;
const SCROLL_EASING_CHECKPOINTS = [
  { time: 0, progress: 0, velocity: 0 },
  { time: 0.25, progress: 0.315, velocity: 1.46 },
  { time: 0.5, progress: 0.75, velocity: 0.98 },
  { time: 0.75, progress: 0.92, velocity: 0.44 },
  { time: 1, progress: 1, velocity: 0 },
] as const;

let activeScrollFrameId: number | null = null;

type LandingScrollLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> & {
  href: `#${string}`;
};

/**
 * 느리게 출발하되 150ms에 약 32%, 300ms에 75%를 이동한다.
 *
 * 마지막 150ms에 8%의 이동량을 남겨 속도가 급격히 떨어지지 않도록 한다.
 */
function getAsymmetricScrollProgress(elapsedPortion: number) {
  const progress = Math.min(Math.max(elapsedPortion, 0), 1);

  if (progress === 0 || progress === 1) {
    return progress;
  }

  const endIndex = SCROLL_EASING_CHECKPOINTS.findIndex((checkpoint) => progress <= checkpoint.time);
  const start = SCROLL_EASING_CHECKPOINTS[endIndex - 1];
  const end = SCROLL_EASING_CHECKPOINTS[endIndex];

  if (!start || !end) {
    return progress;
  }

  const segmentDuration = end.time - start.time;
  const segmentProgress = (progress - start.time) / segmentDuration;
  const squaredProgress = segmentProgress ** 2;
  const cubedProgress = squaredProgress * segmentProgress;

  return (
    (2 * cubedProgress - 3 * squaredProgress + 1) * start.progress +
    (cubedProgress - 2 * squaredProgress + segmentProgress) * segmentDuration * start.velocity +
    (-2 * cubedProgress + 3 * squaredProgress) * end.progress +
    (cubedProgress - squaredProgress) * segmentDuration * end.velocity
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
