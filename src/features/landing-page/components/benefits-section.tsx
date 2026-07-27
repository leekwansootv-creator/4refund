import Image from "next/image";

import styles from "./landing-services-cases.module.css";
import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 센터의 네 가지 서비스 혜택을 첫 항목이 강조된 정적 상태로 제공한다.
 */
export function BenefitsSection() {
  const { benefits, brandName } = LANDING_CONTENT;

  return (
    <section id="services" aria-labelledby="benefits-heading" className="h-[791px] py-[140px]">
      <div className="mx-auto flex h-[511px] w-full max-w-[var(--content-max-width)] flex-col items-center gap-16 px-[var(--content-inline-padding)]">
        <div className="flex h-[141px] w-[532px] flex-col items-center gap-2 text-center">
          <h2
            id="benefits-heading"
            className="text-[42px] leading-[1.3] font-bold tracking-[-0.6px] text-[#141719]"
          >
            왜 <span className={styles.benefitsBrand}>{brandName}</span>에서
            <br />
            환급받아야 할까요?
          </h2>
          <p className="text-lg leading-[1.3] font-medium whitespace-nowrap text-[#2b2b2b]">
            {benefits.description}
          </p>
        </div>

        <ul className="grid h-[306px] w-full grid-cols-4 items-start gap-4">
          {benefits.items.map((benefit, index) => {
            const isActive = index === 0;

            return (
              <li
                key={benefit.title}
                className="flex min-w-0 flex-col items-center gap-8 text-center"
              >
                <div
                  className={
                    isActive ? "relative h-[150px] w-[199px]" : "relative h-[100px] w-[120px]"
                  }
                >
                  <Image
                    src={LANDING_ASSETS.images.benefits[benefit.assetKey]}
                    alt=""
                    fill
                    unoptimized
                    sizes={isActive ? "199px" : "120px"}
                    className="object-contain"
                  />
                </div>

                <div className={isActive ? "flex flex-col items-center gap-6" : undefined}>
                  <h3
                    className={`flex items-end justify-center gap-0.5 text-4xl leading-none font-bold whitespace-nowrap ${
                      isActive ? "text-[#141719]" : "text-[#878787]"
                    }`}
                  >
                    {benefit.title}
                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="mb-0.5 size-2 rounded-full bg-[#006dd2]"
                      />
                    ) : null}
                  </h3>
                  {isActive && "description" in benefit ? (
                    <p className="w-[374px] text-xl leading-[1.6] font-medium whitespace-pre-line text-[#141719]">
                      {benefit.description}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
