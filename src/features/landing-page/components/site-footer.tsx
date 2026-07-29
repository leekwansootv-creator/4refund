import Image from "next/image";

import responsiveStyles from "./landing-responsive.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTACT } from "../constants/landing-contact";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 법률 서비스 고지, 연락처, 주소와 사업자 정보를 제공한다.
 */
export function SiteFooter() {
  const { footer } = LANDING_CONTENT;

  return (
    <footer className={`${responsiveStyles.footer} flex h-[204px] items-center bg-[#f5f6f8] py-8`}>
      <div
        className={`${responsiveStyles.footerInner} mx-auto flex w-full max-w-[var(--content-max-width)] items-end justify-between px-[var(--content-inline-padding)]`}
      >
        <div className="flex flex-col items-start gap-5">
          <a
            className={`${responsiveStyles.interactiveControl} ${responsiveStyles.footerBrand} flex items-center gap-2 rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]`}
            href="#top"
          >
            <Image
              aria-hidden="true"
              src={LANDING_ASSETS.icons.logo}
              alt=""
              width={40}
              height={40}
              className="opacity-50 grayscale"
            />
            <span
              className={`${responsiveStyles.footerBrandText} text-xl leading-none font-black tracking-[-0.5px] text-[#7b7c7e]`}
            >
              {LANDING_CONTENT.brandName}
            </span>
          </a>
          <p
            className={`${responsiveStyles.footerNotice} font-[family-name:var(--font-noto-sans-kr)] text-xs leading-4 font-normal text-[#101010]`}
          >
            {footer.serviceNotice}
          </p>
          <div className="text-base leading-normal font-normal text-[#6a6f73]">
            <p>{footer.copyright}</p>
            <p>{footer.producer}</p>
          </div>
        </div>

        <div className={`${responsiveStyles.footerContact} flex flex-col items-end gap-4`}>
          <address
            className={`${responsiveStyles.footerAddress} flex flex-col items-end justify-center gap-2 not-italic`}
          >
            <a
              className={`${responsiveStyles.interactiveControl} ${responsiveStyles.footerAddressRow} flex items-center justify-end gap-3 rounded-sm text-sm leading-normal font-medium text-[#6a6f73] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]`}
              href={LANDING_CONTACT.emailHref}
            >
              <span>{LANDING_CONTACT.emailDisplay}</span>
              <Image
                aria-hidden="true"
                src={LANDING_ASSETS.icons.email}
                alt=""
                width={13}
                height={10}
                className="h-[10px] w-[13px] opacity-[0.38] brightness-0"
              />
            </a>
            <a
              className={`${responsiveStyles.interactiveControl} ${responsiveStyles.footerAddressRow} flex items-center justify-end gap-3 rounded-sm text-sm leading-normal font-medium text-[#6a6f73] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)]`}
              href={LANDING_CONTACT.phoneHref}
            >
              <span>{LANDING_CONTACT.phoneDisplay}</span>
              <Image
                aria-hidden="true"
                src={LANDING_ASSETS.icons.phone}
                alt=""
                width={13}
                height={13}
                className="size-[13px] opacity-[0.38] brightness-0"
              />
            </a>
            <p
              className={`${responsiveStyles.footerAddressRow} flex items-start justify-end gap-3 font-[family-name:var(--font-noto-sans-kr)] text-sm leading-normal font-medium tracking-[0.28px] text-[#6a6f73]`}
            >
              <span className={responsiveStyles.footerAddressText}>{footer.address}</span>
              <Image
                aria-hidden="true"
                src={LANDING_ASSETS.icons.location}
                alt=""
                width={13}
                height={16}
                className="h-4 w-[13px]"
              />
            </p>
          </address>

          <dl
            className={`${responsiveStyles.footerBusiness} flex flex-col items-end text-right text-base leading-normal text-[#6a6f73]`}
          >
            <div
              className={`${responsiveStyles.footerBusinessRow} flex items-center justify-end gap-1`}
            >
              <dt className="font-bold">상호명</dt>
              <dd className="font-medium">{footer.businessName}</dd>
            </div>
            <div
              className={`${responsiveStyles.footerBusinessRow} flex items-center justify-end gap-1`}
            >
              <dt className="font-bold">대표자</dt>
              <dd className="font-medium">{footer.representative}</dd>
              <span aria-hidden="true" className="font-medium">
                |
              </span>
              <dt className="font-bold">정보보호책임자</dt>
              <dd className="font-medium">{footer.privacyOfficer}</dd>
            </div>
            <div
              className={`${responsiveStyles.footerBusinessRow} flex items-center justify-end gap-1`}
            >
              <dt className="font-bold">사업자등록번호</dt>
              <dd className="font-medium">{footer.businessRegistrationNumber}</dd>
            </div>
          </dl>
        </div>
      </div>
    </footer>
  );
}
