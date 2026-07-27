import { LANDING_CONTENT } from "../constants/landing-content";

/**
 * 센터 구성원과 센터장의 경력 정보를 목록 구조로 제공한다.
 */
export function CenterIntroductionSection() {
  const { centerIntroduction } = LANDING_CONTENT;

  return (
    <section
      id="about"
      aria-labelledby="center-introduction-heading"
      className="border-b border-slate-200 bg-slate-50 py-20"
    >
      <div className="mx-auto w-full max-w-[var(--content-max-width)] px-[var(--content-inline-padding)]">
        <h2
          id="center-introduction-heading"
          className="text-3xl font-bold text-[var(--color-brand-navy)]"
        >
          {centerIntroduction.heading}
        </h2>
        <p className="mt-3 text-lg text-slate-700">{centerIntroduction.description}</p>

        <div className="mt-12">
          <h3 className="text-xl font-bold">{centerIntroduction.membersHeading}</h3>
          <ul className="mt-4 space-y-2">
            {centerIntroduction.members.map((member) => (
              <li key={member}>{member}</li>
            ))}
          </ul>
        </div>

        <div className="mt-12">
          <h3 className="text-xl font-bold">{centerIntroduction.directorHeading}</h3>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            {centerIntroduction.directorCredentials.map((credential) => (
              <li key={credential}>{credential}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
