"use client";

import Image from "next/image";
import type { ButtonHTMLAttributes } from "react";

import { QUICK_ESTIMATE_ASSETS } from "../constants/quick-estimate-assets";

/**
 * 메인 견적 hero에서 dialog를 여는 Figma CTA 시각과 버튼 의미를 제공합니다.
 */
export function QuickEstimateHeroAction({
  type = "button",
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...buttonProps}
      type={type}
      aria-haspopup="dialog"
      className="flex size-full cursor-pointer items-center justify-center gap-2 rounded-[157px] bg-[var(--color-brand-primary)] px-[31px] py-3 text-left text-[19.25px] leading-[19.25px] font-bold whitespace-nowrap text-white shadow-[0_0_6.124px_rgb(0_116_202_/_50%)] transition-colors hover:bg-[#0059b8] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:bg-[#bfbfbf] disabled:opacity-60"
    >
      <span>환급액 조회하기</span>
      <span aria-hidden="true" className="flex size-[21px] items-center justify-center">
        <span className="flex size-[15px] rotate-45 items-center justify-center overflow-hidden">
          <Image
            src={QUICK_ESTIMATE_ASSETS.icons.arrow}
            alt=""
            width={15}
            height={15}
            className="-scale-x-100"
          />
        </span>
      </span>
    </button>
  );
}
