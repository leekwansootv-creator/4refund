import Image from "next/image";

import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTENT } from "../constants/landing-content";

const processArtworkClasses = {
  consultation: "h-[131.202px] w-[121.11px]",
  analysis: "h-[131.315px] w-[83.14px]",
  documents: "h-[130.47px] w-[95.343px]",
  refundComplete: "h-[131.27px] w-[130.105px]",
} as const;

/**
 * 문의부터 환급 완료와 사후관리까지의 절차를 순서 있는 목록으로 제공한다.
 */
export function RefundProcessSection() {
  const { refundProcess } = LANDING_CONTENT;

  return (
    <section
      id="process"
      aria-labelledby="refund-process-heading"
      className="relative flex h-[856.284px] items-start justify-center overflow-hidden px-[var(--content-inline-padding)] py-[140px] text-white"
    >
      <Image
        aria-hidden="true"
        src={LANDING_ASSETS.images.refundProcess.background}
        alt=""
        fill
        sizes="100vw"
        unoptimized
        className="pointer-events-none object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[rgba(19,21,31,0.7)]"
      />

      <div className="relative flex w-full max-w-[var(--content-max-width)] flex-col items-center gap-16">
        <div className="flex w-[532px] flex-col items-center gap-2 text-center leading-[1.3] whitespace-nowrap">
          <h2 id="refund-process-heading" className="text-[42px] font-bold">
            {refundProcess.heading}
          </h2>
          <p className="text-lg font-medium text-[#eaeaea]">{refundProcess.description}</p>
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <ol className="grid h-[353.455px] w-full grid-cols-4 gap-2">
            {refundProcess.steps.map((step) => (
              <li
                key={step.id}
                className="relative flex min-w-0 flex-col items-center justify-center gap-[8.219px] rounded-[13.151px] bg-[rgba(31,32,42,0.8)] p-[26.302px]"
              >
                <span className="absolute top-[16.07px] left-[16.07px] flex size-[36.986px] items-center justify-center rounded-full bg-[#191922] text-[19.726px] leading-[1.3] font-bold">
                  {step.number}
                </span>

                <div className="flex h-[253.152px] w-full flex-col items-center justify-between">
                  <h3 className="w-full text-center text-[20.086px] leading-[1.2] font-bold">
                    {step.title}
                  </h3>
                  <Image
                    aria-hidden="true"
                    src={LANDING_ASSETS.images.refundProcess[step.assetKey]}
                    alt=""
                    width={
                      step.assetKey === "consultation"
                        ? 312
                        : step.assetKey === "analysis"
                          ? 214
                          : step.assetKey === "documents"
                            ? 247
                            : 335
                    }
                    height={338}
                    unoptimized
                    className={processArtworkClasses[step.assetKey]}
                  />
                  <p className="w-full text-center text-[20.086px] leading-[1.2] font-bold whitespace-nowrap">
                    {step.descriptionParts.map((part) => (
                      <span
                        key={part.text}
                        className={
                          "highlighted" in part && part.highlighted ? "text-[#89c6ff]" : undefined
                        }
                      >
                        {part.text}
                      </span>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex h-[64.829px] w-full items-center justify-center gap-[8.184px] rounded-[13.095px] p-3.5 drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <span
              aria-hidden="true"
              className="flex size-[36.829px] shrink-0 items-center justify-center rounded-full bg-[#191922] text-[19.642px] leading-[1.3] font-bold"
            >
              +
            </span>
            <h3 className="text-xl leading-[1.2] font-bold whitespace-nowrap text-[#89c6ff]">
              {refundProcess.aftercareHeading}
            </h3>
            <p className="text-xl leading-[1.2] font-medium whitespace-nowrap">
              {refundProcess.aftercareDescription}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
