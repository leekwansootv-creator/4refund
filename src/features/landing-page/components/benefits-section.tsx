import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 센터를 선택해야 하는 네 가지 서비스 혜택을 정적 목록으로 제공한다.
 */
export function BenefitsSection() {
  const { benefits } = LANDING_CONTENT;

  return (
    <section
      id="services"
      aria-labelledby="benefits-heading"
      className="border-b border-slate-200 py-20"
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <h2 id="benefits-heading" className="text-3xl font-bold text-[var(--color-brand-navy)]">
          {benefits.heading}
        </h2>
        <p className="mt-3 text-lg text-slate-700">{benefits.description}</p>
        <ul className="mt-10 space-y-6">
          {benefits.items.map((benefit) => (
            <li key={benefit.title}>
              <h3 className="text-xl font-bold">{benefit.title}</h3>
              {"description" in benefit ? (
                <p className="mt-2 text-slate-700">{benefit.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
