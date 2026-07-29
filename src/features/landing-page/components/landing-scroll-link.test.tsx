import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LandingScrollLink } from "./landing-scroll-link";

const emptyRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

describe("LandingScrollLink", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 100 });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 3000,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
      }),
    });
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reduced motion 환경에서는 헤더 높이를 제외한 목적지로 즉시 이동한다", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
        if (this.tagName === "HEADER") {
          return { ...emptyRect, bottom: 77, height: 77 } as DOMRect;
        }

        if (this.id === "target") {
          return { ...emptyRect, bottom: 1100, height: 200, top: 900 } as DOMRect;
        }

        return emptyRect as DOMRect;
      });

    render(
      <>
        <header />
        <LandingScrollLink href="#target">주요 서비스</LandingScrollLink>
        <section id="target" />
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "주요 서비스" }));

    expect(window.location.hash).toBe("#target");
    expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 922 });

    rect.mockRestore();
  });

  it("보조키로 새 탐색을 요청하면 브라우저의 기본 링크 동작을 유지한다", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    render(
      <>
        <LandingScrollLink href="#target">주요 서비스</LandingScrollLink>
        <section id="target" />
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "주요 서비스" }), { ctrlKey: true });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });
});
