import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 문의부터 환급 완료와 사후관리까지의 절차를 순서 있는 목록으로 제공한다.
 */
export function RefundProcessSection() {
  const { refundProcess } = LANDING_CONTENT;

  return (
    <section
      id="process"
      aria-labelledby="refund-process-heading"
      className="border-b border-slate-200 bg-[var(--color-brand-navy)] py-20 text-white"
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <h2 id="refund-process-heading" className="text-3xl font-bold">
          {refundProcess.heading}
        </h2>
        <ol className="mt-10 list-decimal space-y-6 pl-6">
          {refundProcess.steps.map((step) => (
            <li key={step.title} className="pl-2">
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="mt-2 text-slate-200">{step.description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 border-t border-slate-500 pt-8">
          <h3 className="text-xl font-bold">{refundProcess.aftercareHeading}</h3>
          <p className="mt-2 text-slate-200">{refundProcess.aftercareDescription}</p>
        </div>
      </div>
    </section>
  );
}
