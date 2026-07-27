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
      className="bg-slate-950 py-16 text-white"
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <p className="text-sm font-bold">{contact.notice}</p>
        <h2 id="contact-heading" className="mt-3 text-3xl font-bold">
          {contact.heading}
        </h2>
        <div className="mt-4 space-y-1 text-slate-300">
          {contact.descriptions.map((description) => (
            <p key={description}>{description}</p>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            className="rounded-md border border-slate-600 px-5 py-4"
            href={LANDING_CONTACT.phoneHref}
          >
            <span className="block text-sm text-slate-300">{contact.phoneLabel}</span>
            <strong className="mt-1 block">{LANDING_CONTACT.phoneDisplay}</strong>
          </a>
          <a
            className="rounded-md border border-slate-600 px-5 py-4"
            href={LANDING_CONTACT.emailHref}
          >
            <span className="block text-sm text-slate-300">{contact.emailLabel}</span>
            <strong className="mt-1 block">{LANDING_CONTACT.emailDisplay}</strong>
          </a>
        </div>
      </div>
    </section>
  );
}
