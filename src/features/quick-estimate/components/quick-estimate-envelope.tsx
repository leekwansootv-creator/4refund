import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./quick-estimate-envelope.module.css";
import { QUICK_ESTIMATE_HERO_ASSETS } from "../constants/quick-estimate-hero-assets";

/** 홈페이지와 외부 삽입이 동일한 편지·동전·버튼 시각을 공유합니다. */
export function QuickEstimateEnvelope({ action }: { action: ReactNode }) {
  return (
    <div aria-label="우리 회사 예상 환급액 조회" className={styles.illustration}>
      <Image
        src={QUICK_ESTIMATE_HERO_ASSETS.envelope.back}
        alt=""
        fill
        loading="eager"
        sizes="442px"
        className={styles.envelopeLayer}
      />
      <div aria-hidden="true" className={styles.paper}>
        <Image
          src={QUICK_ESTIMATE_HERO_ASSETS.envelope.paper}
          alt=""
          width={1024}
          height={1024}
          className={styles.paperImage}
        />
      </div>
      <Image
        src={QUICK_ESTIMATE_HERO_ASSETS.envelope.frontShadow}
        alt=""
        fill
        sizes="442px"
        className={`${styles.envelopeLayer} ${styles.frontShadow}`}
      />
      <Image
        src={QUICK_ESTIMATE_HERO_ASSETS.envelope.front}
        alt=""
        fill
        sizes="442px"
        className={`${styles.envelopeLayer} ${styles.front}`}
      />
      <p className={styles.estimatePrompt}>우리 회사 예상 환급액은?</p>
      <div className={styles.actionSlot}>{action}</div>

      <div aria-hidden="true" className={`${styles.coin} ${styles.coinTop}`}>
        <Image
          src={QUICK_ESTIMATE_HERO_ASSETS.coins}
          alt=""
          width={1536}
          height={1024}
          className={styles.coinImage}
        />
      </div>
      <div aria-hidden="true" className={`${styles.coin} ${styles.coinLeft}`}>
        <div className={styles.coinLeftCrop}>
          <Image
            src={QUICK_ESTIMATE_HERO_ASSETS.coins}
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
            src={QUICK_ESTIMATE_HERO_ASSETS.coins}
            alt=""
            width={1536}
            height={1024}
            className={styles.coinImage}
          />
        </div>
      </div>
    </div>
  );
}
