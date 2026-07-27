import { LANDING_CONTACT } from "../constants/landing-contact";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 브랜드 식별, 섹션 탐색, 연락 진입점을 제공하는 랜딩 페이지 헤더다.
 */
export function SiteHeader() {
  return (
    <header id="top" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-wrap items-center justify-between gap-6 px-[var(--content-inline-padding)] py-5">
        <a className="font-bold text-[var(--color-brand-navy)]" href="#top">
          {LANDING_CONTENT.brandName}
        </a>
        <nav aria-label="주요 메뉴">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {LANDING_CONTENT.navigation.map((item) => (
              <li key={item.href}>
                <a
                  className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                  href={item.href}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <a
            className="font-semibold text-[var(--color-brand-primary)]"
            href={LANDING_CONTACT.phoneHref}
          >
            {LANDING_CONTACT.phoneDisplay}
          </a>
          <a
            className="rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white"
            href="#contact"
          >
            무료 진단 신청
          </a>
        </div>
      </div>
    </header>
  );
}
