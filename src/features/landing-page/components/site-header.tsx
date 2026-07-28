import Image from "next/image";

import responsiveStyles from "./landing-responsive.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTACT } from "../constants/landing-contact";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 브랜드 식별, 섹션 탐색, 연락 진입점을 제공하는 랜딩 페이지 헤더다.
 */
export function SiteHeader() {
  return (
    <header
      id="top"
      className={`${responsiveStyles.header} h-[77px] border border-black/10 bg-white`}
    >
      <div
        className={`${responsiveStyles.headerInner} relative flex h-full w-full items-center justify-between pl-8`}
      >
        <a
          className={`${responsiveStyles.headerBrand} flex items-center gap-3 rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]`}
          href="#top"
        >
          <Image aria-hidden="true" src={LANDING_ASSETS.icons.logo} alt="" width={40} height={40} />
          <span
            className={`${responsiveStyles.headerBrandText} text-xl leading-none font-black tracking-[-0.5px] text-[#0f172a]`}
          >
            {LANDING_CONTENT.brandNameParts.base}
            <span className="text-[var(--color-brand-green)]">
              {LANDING_CONTENT.brandNameParts.emphasis}
            </span>
          </span>
        </a>
        <nav
          aria-label="주요 메뉴"
          className={`${responsiveStyles.headerNav} absolute top-1/2 left-1/2 w-[434px] -translate-x-1/2 -translate-y-1/2`}
        >
          <ul className={`${responsiveStyles.headerNavList} flex items-center justify-between`}>
            {LANDING_CONTENT.navigation.map((item) => (
              <li key={item.href}>
                <a
                  className={`${responsiveStyles.headerNavLink} rounded-sm text-base leading-none font-medium text-[#475569] hover:text-[var(--color-brand-green)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]`}
                  href={item.href}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={`${responsiveStyles.headerActions} flex h-full w-[261px] items-stretch`}>
          <a
            className={`${responsiveStyles.headerAction} flex w-[116px] flex-col items-center justify-center bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm leading-5 font-bold text-white hover:bg-[#0059b8] focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-white`}
            href={LANDING_CONTACT.phoneHref}
          >
            <span
              aria-hidden="true"
              className={`${responsiveStyles.headerActionIcon} flex size-9 items-center justify-center`}
            >
              <Image src={LANDING_ASSETS.icons.phone} alt="" width={29} height={25} />
            </span>
            <span>{LANDING_CONTACT.phoneDisplay}</span>
          </a>
          <a
            className={`${responsiveStyles.headerAction} flex w-[145px] flex-col items-center justify-center border-l border-white/15 bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm leading-5 font-bold text-white hover:bg-[#0059b8] focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-white`}
            href="#contact"
          >
            <span
              aria-hidden="true"
              className={`${responsiveStyles.headerActionIcon} flex size-9 items-center justify-center`}
            >
              <Image src={LANDING_ASSETS.icons.chat} alt="" width={29} height={25} />
            </span>
            <span>{LANDING_CONTENT.navigationCallToActionLabel}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
