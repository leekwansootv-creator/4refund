import Image from "next/image";

import responsiveStyles from "./landing-responsive.module.css";
import styles from "./landing-upper-sections.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
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
      className={`${responsiveStyles.hero} relative flex h-[859px] items-center overflow-hidden text-white`}
    >
      <Image
        priority
        src={LANDING_ASSETS.images.hero}
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div aria-hidden="true" className={`absolute inset-0 ${styles.heroOverlay}`} />

      <div className="relative z-10 mx-auto flex w-full max-w-[var(--content-max-width)] flex-col items-start gap-6 px-[var(--content-inline-padding)]">
        <div className="flex w-full flex-col items-start gap-[18px]">
          <h1
            id="landing-hero-heading"
            className={`${responsiveStyles.heroHeading} w-full text-[clamp(48px,3.333vw,64px)] leading-[1.2] font-bold tracking-[-1px]`}
          >
            <span className="block">{hero.heading.firstLine}</span>
            <span className="block">
              <span className="text-[var(--color-brand-accent)]">
                {hero.heading.highlightedText}
              </span>
              {hero.heading.secondLineSuffix}
            </span>
            <span className="block">{hero.heading.thirdLine}</span>
          </h1>
          <div
            className={`${responsiveStyles.heroDescriptions} w-full text-xl leading-[1.2] font-normal text-white`}
          >
            {hero.descriptions.map((description) => (
              <p key={description}>{description}</p>
            ))}
          </div>
        </div>

        <div className={`${responsiveStyles.heroContactGroup} flex flex-col items-start gap-2`}>
          <div className={`${responsiveStyles.heroActions} flex items-start gap-2.5`}>
            <a
              className={`${responsiveStyles.interactiveControl} ${responsiveStyles.heroCta} flex h-14 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-8 text-xl leading-5 font-bold whitespace-nowrap hover:bg-[#0059b8] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white`}
              href={LANDING_CONTACT.phoneHref}
            >
              <span aria-hidden="true" className="flex size-8 items-center justify-center">
                <Image src={LANDING_ASSETS.icons.phone} alt="" width={29} height={25} />
              </span>
              <span>
                {hero.phoneCtaLabel} {LANDING_CONTACT.phoneDisplay}
              </span>
            </a>
            <a
              className={`${responsiveStyles.interactiveControl} ${responsiveStyles.heroCta} flex h-14 items-center justify-center gap-2 rounded-lg bg-white px-8 text-xl leading-5 font-bold whitespace-nowrap text-[var(--color-brand-primary)] hover:bg-[#e4f4ff] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white`}
              href={LANDING_CONTACT.emailHref}
            >
              <span aria-hidden="true" className="flex size-7 items-center justify-center">
                <Image src={LANDING_ASSETS.icons.email} alt="" width={23} height={18} />
              </span>
              <span>{hero.emailCtaLabel}</span>
            </a>
          </div>
          <div
            className={`${responsiveStyles.heroDetails} flex items-center gap-4 text-sm leading-[1.3] text-[#f6f6f6]`}
          >
            <div className="flex items-center gap-1">
              <span aria-hidden="true" className="size-[5px] rounded-full bg-white" />
              <dl className="flex items-center gap-[9px]">
                <dt>{hero.consultationLabel}</dt>
                <dd className="border-l border-white/70 pl-[9px]">
                  {LANDING_CONTACT.consultationHours}
                </dd>
              </dl>
            </div>
            <div
              className={`${responsiveStyles.heroEmailDetail} flex items-center gap-1 border-l border-white/70 pl-4`}
            >
              <span aria-hidden="true" className="size-[5px] rounded-full bg-white" />
              <dl className="flex items-center gap-[9px]">
                <dt>{hero.emailLabel}</dt>
                <dd className="border-l border-white/70 pl-[9px]">
                  <a
                    className={`${responsiveStyles.interactiveControl} ${responsiveStyles.heroInlineEmail} rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
                    href={LANDING_CONTACT.emailHref}
                  >
                    {LANDING_CONTACT.emailDisplay}
                  </a>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
