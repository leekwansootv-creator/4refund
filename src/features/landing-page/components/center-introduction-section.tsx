import Image from "next/image";

import responsiveStyles from "./landing-responsive.module.css";
import styles from "./landing-upper-sections.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 센터 구성원과 센터장의 경력 정보를 목록 구조로 제공한다.
 */
export function CenterIntroductionSection() {
  const { centerIntroduction } = LANDING_CONTENT;

  return (
    <section
      id="about"
      aria-labelledby="center-introduction-heading"
      className={`${responsiveStyles.centerSection} relative h-[1132px] overflow-hidden bg-[#f1f2f5]`}
    >
      <div className="absolute inset-x-0 top-0 h-[578px]">
        <Image
          src={LANDING_ASSETS.images.centerBackground}
          alt=""
          fill
          sizes="100vw"
          className="object-fill"
        />
      </div>
      <div aria-hidden="true" className={`absolute inset-0 ${styles.centerOverlay}`} />

      <div
        className={`${responsiveStyles.centerInner} relative z-10 flex h-full flex-col items-center gap-[100px] py-[100px]`}
      >
        <div className="w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
          <h2
            id="center-introduction-heading"
            className={`${responsiveStyles.centerHeading} text-[64px] leading-[1.3] font-bold text-[var(--color-brand-navy)]`}
          >
            {centerIntroduction.heading}
          </h2>
          <p
            className={`${responsiveStyles.centerDescription} mt-2.5 text-xl leading-[1.2] text-[#486db2]`}
          >
            {centerIntroduction.description}
          </p>
        </div>

        <div
          className={`${responsiveStyles.centerCard} w-full max-w-[var(--content-max-width)] overflow-hidden rounded-3xl bg-white shadow-[0_0_10px_rgba(163,189,210,0.25)]`}
        >
          <div className={`${responsiveStyles.memberContainer} p-[45px]`}>
            <div className="flex flex-col items-start gap-6">
              <h3 className="text-2xl leading-[1.2] font-bold text-[#0e163d]">
                {centerIntroduction.membersHeading}
              </h3>
              <ul
                className={`${responsiveStyles.memberList} flex w-full items-start justify-between px-[45px]`}
              >
                {centerIntroduction.members.map((member) => (
                  <li
                    key={member.name}
                    className={`${responsiveStyles.memberItem} flex w-[139px] flex-col items-center gap-4 text-center`}
                  >
                    {member.role === null ? (
                      <div
                        className={`${responsiveStyles.memberVisual} flex size-[139px] items-center justify-center rounded-full border border-[#d8dee6] bg-[#f2f6fb]`}
                      >
                        <span className="flex h-[13px] w-[51px] items-center justify-center overflow-hidden">
                          <Image
                            aria-hidden="true"
                            src={LANDING_ASSETS.icons.more}
                            alt=""
                            width={13}
                            height={51}
                            className="h-[51px] w-[13px] rotate-90"
                          />
                        </span>
                      </div>
                    ) : (
                      <Image
                        aria-hidden="true"
                        src={LANDING_ASSETS.images.centerMemberPlaceholder}
                        alt=""
                        width={139}
                        height={139}
                        className={responsiveStyles.memberVisual}
                      />
                    )}
                    <p
                      className={`${responsiveStyles.memberName} w-full text-xl leading-[1.2] text-[#101010]`}
                    >
                      <strong className="font-bold">{member.name}</strong>
                      {member.role === null ? null : ` ${member.role}`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className={`${responsiveStyles.centerDirector} grid h-[393px] grid-cols-[515px_1fr] bg-[#f9fbfe] pt-[45px]`}
          >
            <div className={`${responsiveStyles.directorFigure} relative h-[348px] w-[515px]`}>
              <h3
                className={`${responsiveStyles.directorHeading} absolute top-0 left-[45px] z-10 text-2xl leading-[1.2] font-bold text-[#0e163d]`}
              >
                {centerIntroduction.directorHeading}
              </h3>
              <Image
                src={LANDING_ASSETS.images.centerDirector}
                alt="센터장 이관수"
                fill
                sizes="425px"
                className="object-contain object-right-bottom"
              />
            </div>

            <div
              className={`${responsiveStyles.directorDetails} flex flex-col items-start gap-6 pb-10 pl-[21px]`}
            >
              <p
                className={`${responsiveStyles.directorName} text-4xl leading-[1.2] font-bold text-[#101010]`}
              >
                {centerIntroduction.directorName}
              </p>
              <ul
                className={`${responsiveStyles.credentialList} grid h-[190px] w-full grid-flow-col grid-cols-2 grid-rows-4 gap-x-8 gap-y-2.5`}
              >
                {centerIntroduction.directorCredentials.map((credential) => (
                  <li
                    key={credential}
                    className={`${responsiveStyles.credentialItem} flex items-center gap-4`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full bg-[#006dd2]"
                    />
                    <span
                      className={`${responsiveStyles.credentialText} text-xl leading-[2] font-medium text-[#101010]`}
                    >
                      {credential}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
