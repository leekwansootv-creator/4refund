"use client";

import { useEffect, useState } from "react";

import responsiveStyles from "./landing-responsive.module.css";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 스크롤 위치와 일치하는 헤더 메뉴를 표시하고 각 section 앵커로 이동한다.
 */
export function SiteHeaderNavigation() {
  const [activeHref, setActiveHref] = useState<string | null>(null);

  useEffect(() => {
    let frameId = 0;

    const updateActiveHref = () => {
      const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      const activationLine = headerHeight + window.innerHeight * 0.25;
      let nextActiveHref: string | null = null;

      for (const item of LANDING_CONTENT.navigation) {
        const section = document.querySelector<HTMLElement>(item.href);

        if (section && section.getBoundingClientRect().top <= activationLine) {
          nextActiveHref = item.href;
        }
      }

      setActiveHref((currentHref) =>
        currentHref === nextActiveHref ? currentHref : nextActiveHref,
      );
      frameId = 0;
    };

    const scheduleUpdate = () => {
      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateActiveHref);
      }
    };

    updateActiveHref();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);

      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <nav
      aria-label="주요 메뉴"
      className={`${responsiveStyles.headerNav} absolute top-1/2 left-1/2 w-[434px] -translate-x-1/2 -translate-y-1/2`}
    >
      <ul className={`${responsiveStyles.headerNavList} flex items-center justify-between`}>
        {LANDING_CONTENT.navigation.map((item) => {
          const isCurrent = item.href === activeHref;

          return (
            <li key={item.href}>
              <a
                aria-current={isCurrent ? "location" : undefined}
                className={`${responsiveStyles.headerNavLink} ${
                  isCurrent ? responsiveStyles.headerNavLinkCurrent : ""
                } rounded-sm text-base leading-none font-medium text-[#475569] hover:text-[var(--color-brand-green)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]`}
                href={item.href}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
