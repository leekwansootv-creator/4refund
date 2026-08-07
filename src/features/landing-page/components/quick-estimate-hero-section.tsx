import Image from "next/image";
import type { ReactNode } from "react";

import styles from "./quick-estimate-hero.module.css";
import { RefundCasesTrack } from "./refund-cases-track";
import { QUICK_ESTIMATE_ASSETS } from "@/features/quick-estimate";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 최종 공개 단계에서 기존 hero를 대체할 간단 견적 소개와 환급 사례를 조합합니다.
 *
 * 이 컴포넌트는 PR 6에서 `LandingPage`에 연결하지 않으며, 실제 dialog trigger는
 * 후속 흐름 연동 컴포넌트를 `action` slot으로 전달받습니다.
 */
export function QuickEstimateHeroSection({ action }: { action: ReactNode }) {
  const { refundCases } = LANDING_CONTENT;

  return (
    <section aria-labelledby="quick-estimate-hero-heading" className={styles.hero}>
      <div className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-col items-center gap-3 px-[var(--content-inline-padding)] text-center leading-[1.2] text-black">
        <h1
          id="quick-estimate-hero-heading"
          className="text-[clamp(34px,2.5vw,48px)] font-bold tracking-[-0.5px]"
        >
          {refundCases.heading}
        </h1>
        <p className="max-w-[920px] text-[clamp(16px,1.042vw,20px)] leading-[1.45]">
          {refundCases.description}
        </p>
      </div>

      <div className={styles.illustrationStage}>
        <div aria-label="우리 회사 예상 환급액 조회" className={styles.illustration}>
          <Image
            src={QUICK_ESTIMATE_ASSETS.envelope.back}
            alt=""
            fill
            sizes="442px"
            className={styles.envelopeLayer}
          />
          <div aria-hidden="true" className={styles.paper}>
            <Image
              src={QUICK_ESTIMATE_ASSETS.envelope.paper}
              alt=""
              width={1024}
              height={1024}
              className={styles.paperImage}
            />
          </div>
          <Image
            src={QUICK_ESTIMATE_ASSETS.envelope.frontShadow}
            alt=""
            fill
            sizes="442px"
            className={`${styles.envelopeLayer} ${styles.frontShadow}`}
          />
          <Image
            src={QUICK_ESTIMATE_ASSETS.envelope.front}
            alt=""
            fill
            sizes="442px"
            className={`${styles.envelopeLayer} ${styles.front}`}
          />
          <p className={styles.estimatePrompt}>우리 회사 예상 환급액은?</p>
          <div className={styles.actionSlot}>{action}</div>

          <div aria-hidden="true" className={`${styles.coin} ${styles.coinTop}`}>
            <Image
              src={QUICK_ESTIMATE_ASSETS.coins}
              alt=""
              width={1536}
              height={1024}
              className={styles.coinImage}
            />
          </div>
          <div aria-hidden="true" className={`${styles.coin} ${styles.coinLeft}`}>
            <div className={styles.coinLeftCrop}>
              <Image
                src={QUICK_ESTIMATE_ASSETS.coins}
                alt=""
                width={1536}
                height={1024}
                className={styles.coinImage}
              />
            </div>
          </div>
          <div aria-hidden="true" className={`${styles.coin} ${styles.coinBottom}`}>
            <div className={styles.coinBottomCrop}>
              <Image
                src={QUICK_ESTIMATE_ASSETS.coins}
                alt=""
                width={1536}
                height={1024}
                className={styles.coinImage}
              />
            </div>
          </div>
        </div>
      </div>

      <RefundCasesTrack variant="hero" />
    </section>
  );
}
