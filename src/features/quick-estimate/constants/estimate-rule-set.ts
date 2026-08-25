/** 기존 14개 업종 계산을 재현하는 규칙 version입니다. */
export const ESTIMATE_RULE_V1_VERSION = "estimate-rule-2026-08-05";

/** 한국표준산업분류 대분류 21개를 기존 기준액에 대응한 규칙 version입니다. */
export const ESTIMATE_RULE_V2_VERSION = "estimate-rule-2026-08-25";

/** 공개 브라우저가 현재 사용하는 계산 규칙 version입니다. */
export const ESTIMATE_RULE_VERSION = ESTIMATE_RULE_V1_VERSION;

/** 외부 기준액을 마지막으로 확인한 snapshot 버전입니다. */
export const ESTIMATE_BENCHMARK_VERSION = "incruit-2026-08-05";

const COMMON_ESTIMATE_RULE = {
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
} as const;

/** 기존 화면과 오래된 제출을 재현하기 위해 보존하는 14개 업종 규칙입니다. */
export const ESTIMATE_RULE_SET_V1 = {
  ...COMMON_ESTIMATE_RULE,
  version: ESTIMATE_RULE_V1_VERSION,
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

/** KSIC 대분류 21개를 기존 14개 benchmark 기준액에 대응한 차기 규칙입니다. */
export const ESTIMATE_RULE_SET_V2 = {
  ...COMMON_ESTIMATE_RULE,
  version: ESTIMATE_RULE_V2_VERSION,
  industries: [
    {
      code: "N",
      label: "용역·파견·시설관리업",
      officialLabel: "사업시설 관리, 사업 지원 및 임대 서비스업",
      benchmarkGroupCode: "professional_services",
      benchmarkRatePerEmployee: 171_700,
      baseRatePerEmployee: 181_000,
    },
    {
      code: "T",
      label: "가구 내 고용활동 및 달리 분류되지 않은 자가 소비 생산활동",
      officialLabel: "가구 내 고용활동 및 달리 분류되지 않은 자가 소비 생산활동",
      benchmarkGroupCode: "hospitality_other",
      benchmarkRatePerEmployee: 39_760,
      baseRatePerEmployee: 42_000,
    },
    {
      code: "F",
      label: "건설업",
      officialLabel: "건설업",
      benchmarkGroupCode: "construction_engineering",
      benchmarkRatePerEmployee: 1_518_670,
      baseRatePerEmployee: 1_595_000,
    },
    {
      code: "O",
      label: "공공 행정, 국방 및 사회보장 행정",
      officialLabel: "공공 행정, 국방 및 사회보장 행정",
      benchmarkGroupCode: "education_research",
      benchmarkRatePerEmployee: 82_640,
      baseRatePerEmployee: 87_000,
    },
    {
      code: "B",
      label: "광업",
      officialLabel: "광업",
      benchmarkGroupCode: "industrial_manufacturing",
      benchmarkRatePerEmployee: 101_430,
      baseRatePerEmployee: 107_000,
    },
    {
      code: "P",
      label: "교육 서비스업",
      officialLabel: "교육 서비스업",
      benchmarkGroupCode: "education_research",
      benchmarkRatePerEmployee: 82_640,
      baseRatePerEmployee: 87_000,
    },
    {
      code: "U",
      label: "국제 및 외국기관",
      officialLabel: "국제 및 외국기관",
      benchmarkGroupCode: "professional_services",
      benchmarkRatePerEmployee: 171_700,
      baseRatePerEmployee: 181_000,
    },
    {
      code: "K",
      label: "금융 및 보험업",
      officialLabel: "금융 및 보험업",
      benchmarkGroupCode: "finance_insurance",
      benchmarkRatePerEmployee: 358_800,
      baseRatePerEmployee: 377_000,
    },
    {
      code: "A",
      label: "농업, 임업 및 어업",
      officialLabel: "농업, 임업 및 어업",
      benchmarkGroupCode: "agriculture_fisheries",
      benchmarkRatePerEmployee: 137_810,
      baseRatePerEmployee: 145_000,
    },
    {
      code: "G",
      label: "도매 및 소매업",
      officialLabel: "도매 및 소매업",
      benchmarkGroupCode: "wholesale_retail",
      benchmarkRatePerEmployee: 78_960,
      baseRatePerEmployee: 83_000,
    },
    {
      code: "Q",
      label: "보건업 및 사회복지 서비스업",
      officialLabel: "보건업 및 사회복지 서비스업",
      benchmarkGroupCode: "health_socialcare",
      benchmarkRatePerEmployee: 631_040,
      baseRatePerEmployee: 663_000,
    },
    {
      code: "L",
      label: "부동산업",
      officialLabel: "부동산업",
      benchmarkGroupCode: "real_estate_leasing",
      benchmarkRatePerEmployee: 317_190,
      baseRatePerEmployee: 334_000,
    },
    {
      code: "E",
      label: "수도, 하수 및 폐기물 처리, 원료 재생업",
      officialLabel: "수도, 하수 및 폐기물 처리, 원료 재생업",
      benchmarkGroupCode: "energy_utilities",
      benchmarkRatePerEmployee: 121_190,
      baseRatePerEmployee: 128_000,
    },
    {
      code: "I",
      label: "숙박 및 음식점업",
      officialLabel: "숙박 및 음식점업",
      benchmarkGroupCode: "hospitality_other",
      benchmarkRatePerEmployee: 39_760,
      baseRatePerEmployee: 42_000,
    },
    {
      code: "R",
      label: "예술, 스포츠 및 여가관련 서비스업",
      officialLabel: "예술, 스포츠 및 여가관련 서비스업",
      benchmarkGroupCode: "publishing_media",
      benchmarkRatePerEmployee: 80_790,
      baseRatePerEmployee: 85_000,
    },
    {
      code: "H",
      label: "운수 및 창고업",
      officialLabel: "운수 및 창고업",
      benchmarkGroupCode: "transport_logistics",
      benchmarkRatePerEmployee: 67_190,
      baseRatePerEmployee: 71_000,
    },
    {
      code: "D",
      label: "전기, 가스, 증기 및 공기 조절 공급업",
      officialLabel: "전기, 가스, 증기 및 공기 조절 공급업",
      benchmarkGroupCode: "energy_utilities",
      benchmarkRatePerEmployee: 121_190,
      baseRatePerEmployee: 128_000,
    },
    {
      code: "M",
      label: "전문, 과학 및 기술 서비스업",
      officialLabel: "전문, 과학 및 기술 서비스업",
      benchmarkGroupCode: "professional_services",
      benchmarkRatePerEmployee: 171_700,
      baseRatePerEmployee: 181_000,
    },
    {
      code: "J",
      label: "정보통신업",
      officialLabel: "정보통신업",
      benchmarkGroupCode: "software_it",
      benchmarkRatePerEmployee: 118_030,
      baseRatePerEmployee: 124_000,
    },
    {
      code: "C",
      label: "제조업",
      officialLabel: "제조업",
      benchmarkGroupCode: "industrial_manufacturing",
      benchmarkRatePerEmployee: 101_430,
      baseRatePerEmployee: 107_000,
    },
    {
      code: "S",
      label: "협회 및 단체, 수리 및 기타 개인 서비스업",
      officialLabel: "협회 및 단체, 수리 및 기타 개인 서비스업",
      benchmarkGroupCode: "hospitality_other",
      benchmarkRatePerEmployee: 39_760,
      baseRatePerEmployee: 42_000,
    },
  ],
} as const;

/** 서버가 정확한 version으로 재계산할 수 있는 간단 견적 규칙 목록입니다. */
export const ESTIMATE_RULE_SETS = [ESTIMATE_RULE_SET_V1, ESTIMATE_RULE_SET_V2] as const;

/** 공개 브라우저가 현재 사용하는 간단 견적 규칙입니다. */
export const ESTIMATE_RULE_SET = ESTIMATE_RULE_SET_V1;

/** v1 또는 v2에서 계산 가능한 4refund 업종 코드입니다. */
export type EstimateIndustryCode =
  | (typeof ESTIMATE_RULE_SET_V1.industries)[number]["code"]
  | (typeof ESTIMATE_RULE_SET_V2.industries)[number]["code"];

/** 서버가 허용하는 간단 견적 규칙 version입니다. */
export type EstimateRuleVersion = (typeof ESTIMATE_RULE_SETS)[number]["version"];

/** version별 규칙에서 사용하는 업종별 기준액 계약입니다. */
export type EstimateIndustryRule = {
  code: EstimateIndustryCode;
  label: string;
  officialLabel?: string;
  benchmarkGroupCode?: (typeof ESTIMATE_RULE_SET_V1.industries)[number]["code"];
  benchmarkRatePerEmployee: number;
  baseRatePerEmployee: number;
};

/** 계산과 서버 재검증에서 사용하는 version별 규칙 계약입니다. */
export type EstimateRuleSet = {
  version: EstimateRuleVersion;
  benchmarkVersion: typeof ESTIMATE_BENCHMARK_VERSION;
  currency: "KRW";
  displayUnit: number;
  maxDisplayAmount: number;
  randomUpliftBps: {
    min: number;
    max: number;
  };
  employeeCount: {
    min: number;
    max: number;
  };
  industries: readonly EstimateIndustryRule[];
};

/** 요청된 version과 정확히 일치하는 계산 규칙을 반환합니다. */
export function getEstimateRuleSet(ruleVersion: string): EstimateRuleSet | undefined {
  return ESTIMATE_RULE_SETS.find(({ version }) => version === ruleVersion);
}

/** 규칙 version과 업종 코드가 함께 일치하는 업종 계약을 반환합니다. */
export function getEstimateIndustryRule(
  ruleVersion: string,
  industryCode: string,
): EstimateIndustryRule | undefined {
  return getEstimateRuleSet(ruleVersion)?.industries.find(({ code }) => code === industryCode);
}
