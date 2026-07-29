"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

const SCROLL_DURATION_MS = 600;
const SPRING_MASS = 1;
const SPRING_STIFFNESS = 80;
const SPRING_DAMPING = 20;
const SPRING_INITIAL_VELOCITY = 0;

let activeScrollFrameId: number | null = null;

type LandingScrollLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> & {
  href: `#${string}`;
};

/**
 * Figma의 Spring 설정을 WebKit SpringSolver와 같은 시간 함수로 계산한다.
 *
 * 현재 설정은 150ms에 약 39%, 300ms에 약 75%, 450ms에 약 91%를 이동하며,
 * Figma와 동일하게 600ms가 끝나는 시점에는 목표 위치를 확정한다.
 */
function getSpringScrollProgress(elapsedPortion: number) {
  const progress = Math.min(Math.max(elapsedPortion, 0), 1);

  if (progress === 0 || progress === 1) {
    return progress;
  }

  const elapsedSeconds = (SCROLL_DURATION_MS / 1000) * progress;
  const naturalFrequency = Math.sqrt(SPRING_STIFFNESS / SPRING_MASS);
  const dampingRatio = SPRING_DAMPING / (2 * Math.sqrt(SPRING_STIFFNESS * SPRING_MASS));

  if (dampingRatio < 1) {
    const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio ** 2);
    const velocityCoefficient =
      (dampingRatio * naturalFrequency - SPRING_INITIAL_VELOCITY) / dampedFrequency;
    const displacement =
      Math.exp(-elapsedSeconds * dampingRatio * naturalFrequency) *
      (Math.cos(dampedFrequency * elapsedSeconds) +
        velocityCoefficient * Math.sin(dampedFrequency * elapsedSeconds));

    return 1 - displacement;
  }

  const displacement =
    (1 + (naturalFrequency - SPRING_INITIAL_VELOCITY) * elapsedSeconds) *
    Math.exp(-naturalFrequency * elapsedSeconds);

  return 1 - displacement;
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
      top: startScrollTop + scrollDistance * getSpringScrollProgress(elapsedPortion),
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
