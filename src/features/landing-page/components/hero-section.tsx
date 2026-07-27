import { LANDING_CONTACT } from "../constants/landing-contact";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 환급 권리 안내와 전화·이메일 상담 진입점을 제공한다.
 */
export function HeroSection() {
  const { hero } = LANDING_CONTENT;

  return (
    <section
      aria-labelledby="landing-hero-heading"
      className="bg-[var(--color-brand-navy)] py-24 text-white"
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <h1 id="landing-hero-heading" className="max-w-4xl text-4xl leading-tight font-bold">
          {hero.heading}
        </h1>
        <div className="mt-6 space-y-2 text-lg text-slate-100">
          {hero.descriptions.map((description) => (
            <p key={description}>{description}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            className="rounded-md bg-[var(--color-brand-primary)] px-5 py-3 font-semibold"
            href={LANDING_CONTACT.phoneHref}
          >
            {hero.phoneCtaLabel} {LANDING_CONTACT.phoneDisplay}
          </a>
          <a
            className="rounded-md bg-white px-5 py-3 font-semibold text-[var(--color-brand-primary)]"
            href={LANDING_CONTACT.emailHref}
          >
            {hero.emailCtaLabel}
          </a>
        </div>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-200">
          <div className="flex gap-2">
            <dt>{hero.consultationLabel}</dt>
            <dd>{LANDING_CONTACT.consultationHours}</dd>
          </div>
          <div className="flex gap-2">
            <dt>{hero.emailLabel}</dt>
            <dd>
              <a className="underline underline-offset-4" href={LANDING_CONTACT.emailHref}>
                {LANDING_CONTACT.emailDisplay}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
