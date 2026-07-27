import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 업종별 익명 환급 사례와 환급 총액을 순서 있는 콘텐츠로 제공한다.
 */
export function RefundCasesSection() {
  const { refundCases } = LANDING_CONTENT;

  return (
    <section
      aria-labelledby="refund-cases-heading"
      className="border-b border-slate-200 bg-slate-50 py-20"
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <h2 id="refund-cases-heading" className="text-3xl font-bold text-[var(--color-brand-navy)]">
          {refundCases.heading}
        </h2>
        <ul className="mt-10 space-y-6">
          {refundCases.items.map((refundCase) => (
            <li key={`${refundCase.company}-${refundCase.amount}`}>
              <h3 className="text-xl font-bold">
                {refundCase.industry} · {refundCase.company}
              </h3>
              <p className="mt-1 text-slate-700">
                환급 총액{" "}
                <strong className="text-[var(--color-brand-primary)]">{refundCase.amount}</strong>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
