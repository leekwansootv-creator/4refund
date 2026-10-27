import Image from "next/image";

import { CenterLeaderProfile } from "./center-leader-profile";

import responsiveStyles from "./landing-responsive.module.css";
import styles from "./landing-upper-sections.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

// 큰 원본은 유지하고 원형 슬롯 안의 얼굴 크기와 위치만 조정한다.
const memberImageCropStyles = {
  leeKwanSoo: {
    objectPosition: "55% 20%",
    transform: "translate(2%, 5%) scale(1.5)",
    transformOrigin: "55% 0%",
  },
  parkJinSeok: {
    objectPosition: "50% 0%",
    transform: "translate(-25%, -54%) scale(2.6)",
    transformOrigin: "50% 0%",
  },
  kimMinHan: {
    objectPosition: "50% 0%",
    transform: "translate(-1%, -3%) scale(1.4)",
    transformOrigin: "50% 0%",
  },
  parkSeolYoung: {
    objectPosition: "50% 0%",
    transform: "translate(1%, -3%) scale(1.4)",
    transformOrigin: "50% 0%",
  },
  kimSangJae: {
    objectPosition: "50% 20%",
    transform: "translate(-2%, -3%) scale(1.55)",
    transformOrigin: "50% 0%",
  },
  leeJeongGye: {
    objectPosition: "50% 50%",
    transform: "translate(0%, 2%) scale(1.02)",
    transformOrigin: "50% 50%",
  },
} as const;

/**
 * 실제 구성원 사진과 센터장·부센터장의 경력을 목록 구조로 제공한다.
 */
export function CenterIntroductionSection() {
  const { centerIntroduction } = LANDING_CONTENT;

  return (
    <section
      id="about"
      aria-labelledby="center-introduction-heading"
      className={`${responsiveStyles.centerSection} relative min-h-[1580px] overflow-hidden bg-[#f1f2f5]`}
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
                    <div
                      className={`${responsiveStyles.memberVisual} relative size-[139px] overflow-hidden rounded-full border border-[#d8dee6] bg-[#f2f6fb]`}
                    >
                      <Image
                        src={LANDING_ASSETS.images.centerMembers[member.assetKey]}
                        alt=""
                        fill
                        sizes="139px"
                        className="object-cover"
                        style={memberImageCropStyles[member.assetKey]}
                      />
                    </div>
                    <p
                      className={`${responsiveStyles.memberName} w-full text-xl leading-[1.2] text-[#101010]`}
                    >
                      <strong className="font-bold">{member.name}</strong>
                      {` ${member.role}`}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="w-full text-right text-base text-[#6a6f73]">
                {centerIntroduction.moreMembers}
              </p>
            </div>
          </div>

          <CenterLeaderProfile
            heading="센터장"
            name={centerIntroduction.directorName}
            role="노무사"
            credentials={centerIntroduction.directorCredentials}
            image={{ src: LANDING_ASSETS.images.centerDirector, position: "left" }}
          />
          <CenterLeaderProfile
            heading={centerIntroduction.deputyHeading}
            name={centerIntroduction.deputyName}
            role="세무사"
            credentials={centerIntroduction.deputyCredentials}
            image={{ src: LANDING_ASSETS.images.centerDeputy, position: "right", crop: "deputy" }}
          />
        </div>
      </div>
    </section>
  );
}
