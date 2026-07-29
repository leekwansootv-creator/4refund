"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

const SCROLL_DURATION_MS = 600;
const SPRING_MASS = 1;
const SPRING_STIFFNESS = 80;
const SPRING_DAMPING = 20;
const SPRING_INITIAL_VELOCITY = 0;
const SPRING_SETTLING_START_PORTION = 0.5;

let activeScrollFrameId: number | null = null;

type LandingScrollLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href" | "onClick"> & {
  href: `#${string}`;
};

/**
 * Figma의 Spring 설정으로 위치와 시간 기준 속도·가속도를 계산한다.
 *
 * WebKit SpringSolver와 같이 감쇠비가 1 이상이면 임계 감쇠식으로 계산한다.
 */
function getSpringScrollState(elapsedPortion: number) {
  const progress = Math.min(Math.max(elapsedPortion, 0), 1);
  const elapsedSeconds = (SCROLL_DURATION_MS / 1000) * progress;
  const durationSeconds = SCROLL_DURATION_MS / 1000;
  const naturalFrequency = Math.sqrt(SPRING_STIFFNESS / SPRING_MASS);
  const criticalDamping = 2 * Math.sqrt(SPRING_STIFFNESS * SPRING_MASS);
  const dampingRatio = SPRING_DAMPING / criticalDamping;

  let springProgress: number;
  let velocityPerSecond: number;
  let solverDamping: number;

  if (dampingRatio < 1) {
    const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio ** 2);
    const velocityCoefficient =
      (dampingRatio * naturalFrequency - SPRING_INITIAL_VELOCITY) / dampedFrequency;
    const decay = Math.exp(-elapsedSeconds * dampingRatio * naturalFrequency);
    const cosine = Math.cos(dampedFrequency * elapsedSeconds);
    const sine = Math.sin(dampedFrequency * elapsedSeconds);
    const displacement = decay * (cosine + velocityCoefficient * sine);

    springProgress = 1 - displacement;
    velocityPerSecond =
      decay *
      (dampingRatio * naturalFrequency * (cosine + velocityCoefficient * sine) +
        dampedFrequency * sine -
        velocityCoefficient * dampedFrequency * cosine);
    solverDamping = SPRING_DAMPING;
  } else {
    const velocityCoefficient = naturalFrequency - SPRING_INITIAL_VELOCITY;
    const decay = Math.exp(-naturalFrequency * elapsedSeconds);
    const displacement = (1 + velocityCoefficient * elapsedSeconds) * decay;

    springProgress = 1 - displacement;
    velocityPerSecond =
      (naturalFrequency * (1 + velocityCoefficient * elapsedSeconds) - velocityCoefficient) * decay;
    solverDamping = criticalDamping;
  }

  const accelerationPerSecondSquared =
    (SPRING_STIFFNESS * (1 - springProgress) - solverDamping * velocityPerSecond) / SPRING_MASS;

  return {
    acceleration: accelerationPerSecondSquared * durationSeconds ** 2,
    progress: springProgress,
    velocity: velocityPerSecond * durationSeconds,
  };
}

/**
 * Spring의 중간 상태를 이어받아 600ms에 위치·속도·가속도가 함께 수렴하도록 보정한다.
 */
function getSpringScrollProgress(elapsedPortion: number) {
  const progress = Math.min(Math.max(elapsedPortion, 0), 1);

  if (progress === 0 || progress === 1) {
    return progress;
  }

  if (progress <= SPRING_SETTLING_START_PORTION) {
    return getSpringScrollState(progress).progress;
  }

  const settlingDuration = 1 - SPRING_SETTLING_START_PORTION;
  const settlingProgress = (progress - SPRING_SETTLING_START_PORTION) / settlingDuration;
  const squaredProgress = settlingProgress ** 2;
  const cubedProgress = squaredProgress * settlingProgress;
  const fourthPowerProgress = cubedProgress * settlingProgress;
  const fifthPowerProgress = fourthPowerProgress * settlingProgress;
  const startState = getSpringScrollState(SPRING_SETTLING_START_PORTION);
  const startVelocity = startState.velocity * settlingDuration;
  const startAcceleration = startState.acceleration * settlingDuration ** 2;
  const startPositionBasis =
    1 - 10 * cubedProgress + 15 * fourthPowerProgress - 6 * fifthPowerProgress;
  const endPositionBasis = 10 * cubedProgress - 15 * fourthPowerProgress + 6 * fifthPowerProgress;
  const startVelocityBasis =
    settlingProgress - 6 * cubedProgress + 8 * fourthPowerProgress - 3 * fifthPowerProgress;
  const startAccelerationBasis =
    (squaredProgress - 3 * cubedProgress + 3 * fourthPowerProgress - fifthPowerProgress) / 2;

  return (
    startPositionBasis * startState.progress +
    endPositionBasis +
    startVelocityBasis * startVelocity +
    startAccelerationBasis * startAcceleration
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
