import Image from "next/image";

import { LANDING_ASSETS } from "../constants/landing-assets";
import { LANDING_CONTACT } from "../constants/landing-contact";
import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 페이지 마지막에서 전화와 이메일 상담으로 전환하는 연락 영역이다.
 */
export function ContactSection() {
  const { contact } = LANDING_CONTENT;

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="flex h-[300px] items-center bg-[#111118] py-12 text-white"
    >
      <div className="mx-auto flex w-full max-w-[var(--content-max-width)] items-center justify-between px-[var(--content-inline-padding)]">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
          <p className="w-full text-xs leading-normal font-bold">{contact.notice}</p>
          <h2 id="contact-heading" className="w-full text-[32px] leading-normal font-extrabold">
            {contact.heading}
          </h2>
          <div className="w-full text-[15px] leading-[1.6] font-medium text-[#94a3b8]">
            {contact.descriptions.map((description) => (
              <p key={description}>{description}</p>
            ))}
          </div>
        </div>

        <div className="flex w-[526px] shrink-0 flex-col items-end justify-center gap-3">
          <a
            className="flex h-24 w-full items-center rounded-2xl border border-[#3e3e4a] bg-[#181820] p-6 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#89c6ff]"
            href={LANDING_CONTACT.phoneHref}
          >
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#515156] bg-[#111118]"
            >
              <Image
                src={LANDING_ASSETS.icons.phone}
                alt=""
                width={28}
                height={28}
                className="size-7 object-contain"
              />
            </span>
            <span className="ml-4 flex min-w-0 flex-1 flex-col items-start gap-1 leading-normal">
              <span className="text-[13px] font-bold text-[#c0c0c0]">{contact.phoneLabel}</span>
              <strong className="text-xl font-extrabold">{LANDING_CONTACT.phoneDisplay}</strong>
            </span>
          </a>

          <a
            className="flex h-24 w-full items-center rounded-2xl border border-[#3e3e4a] bg-[#181820] p-6 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#89c6ff]"
            href={LANDING_CONTACT.emailHref}
          >
            <span
              aria-hidden="true"
              className="flex size-12 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#515156] bg-[#111118]"
            >
              <Image
                src={LANDING_ASSETS.icons.email}
                alt=""
                width={28}
                height={28}
                className="size-7 object-contain brightness-0 invert"
              />
            </span>
            <span className="ml-4 flex min-w-0 flex-1 flex-col items-start gap-1 leading-normal">
              <span className="text-[13px] font-bold text-[#c0c0c0]">{contact.emailLabel}</span>
              <strong className="text-xl font-extrabold">{LANDING_CONTACT.emailDisplay}</strong>
            </span>
            <Image
              aria-hidden="true"
              src={LANDING_ASSETS.icons.arrowUpRight}
              alt=""
              width={30}
              height={30}
              className="size-[30px] -scale-x-100"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
