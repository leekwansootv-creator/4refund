/** 간단 견적 계산 결과를 재현할 때 사용하는 규칙 버전입니다. */
export const ESTIMATE_RULE_VERSION = "estimate-rule-2026-08-05";

/** 외부 기준액을 마지막으로 확인한 snapshot 버전입니다. */
export const ESTIMATE_BENCHMARK_VERSION = "incruit-2026-08-05";

/**
 * 디자인과 저장소에 독립적인 간단 견적 계산 규칙입니다.
 *
 * 사원 수 상한은 모든 업종에 300bp를 적용해도 100억 원을 넘지 않는
 * 6,000명으로 제한합니다. 금액을 상한에 맞춰 자르면 계산 근거가 달라지므로
 * 향후 규칙 변경으로 상한을 넘는 경우에는 계산을 거절해야 합니다.
 */
export const ESTIMATE_RULE_SET = {
  version: ESTIMATE_RULE_VERSION,
  benchmarkVersion: ESTIMATE_BENCHMARK_VERSION,
  currency: "KRW",
  displayUnit: 10_000,
  maxDisplayAmount: 10_000_000_000,
  randomUpliftBps: {
    min: 100,
    max: 300,
  },
  employeeCount: {
    min: 1,
    max: 6_000,
  },
  industries: [
    {
      code: "software_it",
      label: "IT·소프트웨어",
      benchmarkRatePerEmployee: 118_030,
      baseRatePerEmployee: 124_000,
    },
    {
      code: "construction_engineering",
      label: "건설·엔지니어링",
      benchmarkRatePerEmployee: 1_518_670,
      baseRatePerEmployee: 1_595_000,
    },
    {
      code: "education_research",
      label: "교육·연구기관",
      benchmarkRatePerEmployee: 82_640,
      baseRatePerEmployee: 87_000,
    },
    {
      code: "finance_insurance",
      label: "금융·보험업",
      benchmarkRatePerEmployee: 358_800,
      baseRatePerEmployee: 377_000,
    },
    {
      code: "hospitality_other",
      label: "숙박·음식·기타 사업",
      benchmarkRatePerEmployee: 39_760,
      baseRatePerEmployee: 42_000,
    },
    {
      code: "transport_logistics",
      label: "운송·물류",
      benchmarkRatePerEmployee: 67_190,
      baseRatePerEmployee: 71_000,
    },
    {
      code: "agriculture_fisheries",
      label: "농림·수산업",
      benchmarkRatePerEmployee: 137_810,
      baseRatePerEmployee: 145_000,
    },
    {
      code: "real_estate_leasing",
      label: "부동산·임대",
      benchmarkRatePerEmployee: 317_190,
      baseRatePerEmployee: 334_000,
    },
    {
      code: "professional_services",
      label: "전문·사업지원 서비스",
      benchmarkRatePerEmployee: 171_700,
      baseRatePerEmployee: 181_000,
    },
    {
      code: "energy_utilities",
      label: "전기·가스·에너지",
      benchmarkRatePerEmployee: 121_190,
      baseRatePerEmployee: 128_000,
    },
    {
      code: "wholesale_retail",
      label: "도소매·유통",
      benchmarkRatePerEmployee: 78_960,
      baseRatePerEmployee: 83_000,
    },
    {
      code: "health_socialcare",
      label: "의료·사회복지",
      benchmarkRatePerEmployee: 631_040,
      baseRatePerEmployee: 663_000,
    },
    {
      code: "industrial_manufacturing",
      label: "제조·자동차·반도체",
      benchmarkRatePerEmployee: 101_430,
      baseRatePerEmployee: 107_000,
    },
    {
      code: "publishing_media",
      label: "출판·미디어",
      benchmarkRatePerEmployee: 80_790,
      baseRatePerEmployee: 85_000,
    },
  ],
} as const;

/** 현재 규칙에서 계산 가능한 4refund 업종 코드입니다. */
export type EstimateIndustryCode = (typeof ESTIMATE_RULE_SET.industries)[number]["code"];

/** 현재 규칙에 포함된 업종별 기준액 계약입니다. */
export type EstimateIndustryRule = (typeof ESTIMATE_RULE_SET.industries)[number];
