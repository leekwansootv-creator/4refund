import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 상담 범위, 수수료, 정보 보안에 관한 전문가 강점을 설명한다.
 */
export function ExpertStrengthsSection() {
  const { expertStrengths } = LANDING_CONTENT;

  return (
    <section
      id="strengths"
      aria-labelledby="expert-strengths-heading"
      className="border-b border-slate-200 py-20"
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <h2
          id="expert-strengths-heading"
          className="text-3xl font-bold text-[var(--color-brand-navy)]"
        >
          {expertStrengths.heading}
        </h2>
        <div className="mt-10 space-y-10">
          {expertStrengths.items.map((strength) => (
            <article key={strength.id} aria-labelledby={`strength-${strength.id}`}>
              <h3 id={`strength-${strength.id}`} className="text-xl font-bold">
                {strength.title}
              </h3>
              <p className="mt-2 text-slate-700">{strength.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
