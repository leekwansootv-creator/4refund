import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsSection } from "./benefits-section";

const observedCallbacks: IntersectionObserverCallback[] = [];

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0, 0.25];

  constructor(callback: IntersectionObserverCallback) {
    observedCallbacks.push(callback);
  }

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

function triggerIntersection(target: Element, ratio: number) {
  const callback = observedCallbacks.at(-1);

  if (!callback) {
    throw new Error("IntersectionObserver callback이 등록되지 않았습니다.");
  }

  const rect = target.getBoundingClientRect();
  const observer = new IntersectionObserverMock(() => undefined);

  callback(
    [
      {
        boundingClientRect: rect,
        intersectionRatio: ratio,
        intersectionRect: rect,
        isIntersecting: ratio > 0,
        rootBounds: rect,
        target,
        time: performance.now(),
      },
    ],
    observer,
  );
}

describe("BenefitsSection", () => {
  beforeEach(() => {
    observedCallbacks.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("25% 진입 후 1600ms마다 선택을 순환하고 사용자 선택을 현재 인덱스로 이어간다", () => {
    render(<BenefitsSection />);

    const section = document.querySelector("#services");
    const buttons = screen.getAllByRole("button");

    if (!section) {
      throw new Error("서비스 section을 찾을 수 없습니다.");
    }

    act(() => triggerIntersection(section, 0.25));
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");

    act(() => vi.advanceTimersByTime(1600));
    expect(buttons[1]).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(buttons[3] as HTMLElement);
    expect(buttons[3]).toHaveAttribute("aria-expanded", "true");

    act(() => vi.advanceTimersByTime(1600));
    expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
  });
});
