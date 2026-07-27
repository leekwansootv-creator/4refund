import { LANDING_CONTACT } from "../constants/landing-contact";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 법률 서비스 고지, 연락처, 주소와 사업자 정보를 제공한다.
 */
export function SiteFooter() {
  const { footer } = LANDING_CONTENT;

  return (
    <footer className="bg-slate-100 py-10 text-sm text-slate-700">
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <p className="font-bold text-[var(--color-brand-navy)]">{LANDING_CONTENT.brandName}</p>
        <p className="mt-4">{footer.serviceNotice}</p>
        <address className="mt-6 space-y-2 not-italic">
          <p>
            <a className="underline underline-offset-4" href={LANDING_CONTACT.emailHref}>
              {LANDING_CONTACT.emailDisplay}
            </a>
          </p>
          <p>
            <a className="underline underline-offset-4" href={LANDING_CONTACT.phoneHref}>
              {LANDING_CONTACT.phoneDisplay}
            </a>
          </p>
          <p>{footer.address}</p>
        </address>
        <dl className="mt-6 space-y-2">
          <div className="flex flex-wrap gap-2">
            <dt className="font-bold">상호명</dt>
            <dd>{footer.businessName}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-bold">대표자</dt>
            <dd>{footer.representative}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-bold">정보보호책임자</dt>
            <dd>{footer.privacyOfficer}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-bold">사업자등록번호</dt>
            <dd>{footer.businessRegistrationNumber}</dd>
          </div>
        </dl>
        <div className="mt-6 space-y-1 text-slate-500">
          <p>{footer.copyright}</p>
          <p>{footer.producer}</p>
        </div>
      </div>
    </footer>
  );
}
