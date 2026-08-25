import { describe, expect, it } from "vitest";

import {
  ESTIMATE_RULE_SET,
  ESTIMATE_RULE_SET_V2,
  ESTIMATE_RULE_V2_VERSION,
} from "../constants/estimate-rule-set";
import { calculateEstimate } from "./calculate-estimate";

const employeeExamples = [1, 10, 50, 100] as const;

const expectedRanges = {
  software_it: [
    [130_000, 130_000],
    [1_260_000, 1_280_000],
    [6_270_000, 6_390_000],
    [12_530_000, 12_780_000],
  ],
  construction_engineering: [
    [1_620_000, 1_650_000],
    [16_110_000, 16_430_000],
    [80_550_000, 82_150_000],
    [161_100_000, 164_290_000],
  ],
  education_research: [
    [90_000, 90_000],
    [880_000, 900_000],
    [4_400_000, 4_490_000],
    [8_790_000, 8_970_000],
  ],
  finance_insurance: [
    [390_000, 390_000],
    [3_810_000, 3_890_000],
    [19_040_000, 19_420_000],
    [38_080_000, 38_840_000],
  ],
  hospitality_other: [
    [50_000, 50_000],
    [430_000, 440_000],
    [2_130_000, 2_170_000],
    [4_250_000, 4_330_000],
  ],
  transport_logistics: [
    [80_000, 80_000],
    [720_000, 740_000],
    [3_590_000, 3_660_000],
    [7_180_000, 7_320_000],
  ],
  agriculture_fisheries: [
    [150_000, 150_000],
    [1_470_000, 1_500_000],
    [7_330_000, 7_470_000],
    [14_650_000, 14_940_000],
  ],
  real_estate_leasing: [
    [340_000, 350_000],
    [3_380_000, 3_450_000],
    [16_870_000, 17_210_000],
    [33_740_000, 34_410_000],
  ],
  professional_services: [
    [190_000, 190_000],
    [1_830_000, 1_870_000],
    [9_150_000, 9_330_000],
    [18_290_000, 18_650_000],
  ],
  energy_utilities: [
    [130_000, 140_000],
    [1_300_000, 1_320_000],
    [6_470_000, 6_600_000],
    [12_930_000, 13_190_000],
  ],
  wholesale_retail: [
    [90_000, 90_000],
    [840_000, 860_000],
    [4_200_000, 4_280_000],
    [8_390_000, 8_550_000],
  ],
  health_socialcare: [
    [670_000, 690_000],
    [6_700_000, 6_830_000],
    [33_490_000, 34_150_000],
    [66_970_000, 68_290_000],
  ],
  industrial_manufacturing: [
    [110_000, 120_000],
    [1_090_000, 1_110_000],
    [5_410_000, 5_520_000],
    [10_810_000, 11_030_000],
  ],
  publishing_media: [
    [90_000, 90_000],
    [860_000, 880_000],
    [4_300_000, 4_380_000],
    [8_590_000, 8_760_000],
  ],
} satisfies Record<
  (typeof ESTIMATE_RULE_SET.industries)[number]["code"],
  readonly (readonly [number, number])[]
>;

describe("calculateEstimate", () => {
  it("14개 업종의 1명, 10명, 50명, 100명 경계 예시를 재현한다", () => {
    for (const industry of ESTIMATE_RULE_SET.industries) {
      employeeExamples.forEach((employeeCount, index) => {
        const expectedRange = expectedRanges[industry.code][index];

        expect(
          calculateEstimate({
            industryCode: industry.code,
            employeeCount,
            randomUpliftBps: 100,
          }),
        ).toMatchObject({ status: "calculated", amount: expectedRange?.[0] });
        expect(
          calculateEstimate({
            industryCode: industry.code,
            employeeCount,
            randomUpliftBps: 300,
          }),
        ).toMatchObject({ status: "calculated", amount: expectedRange?.[1] });
      });
    }
  });

  it("모든 업종과 1~6,000명에서 benchmark보다 최소 1만 원 높다", () => {
    for (const industry of ESTIMATE_RULE_SET.industries) {
      for (
        let employeeCount = ESTIMATE_RULE_SET.employeeCount.min;
        employeeCount <= ESTIMATE_RULE_SET.employeeCount.max;
        employeeCount += 1
      ) {
        const benchmarkAmount =
          Math.round(
            (industry.benchmarkRatePerEmployee * employeeCount) / ESTIMATE_RULE_SET.displayUnit,
          ) * ESTIMATE_RULE_SET.displayUnit;

        for (const randomUpliftBps of [100, 300]) {
          const result = calculateEstimate({
            industryCode: industry.code,
            employeeCount,
            randomUpliftBps,
          });

          if (result.status !== "calculated") {
            throw new Error(`${industry.code}, ${employeeCount}명, ${randomUpliftBps}bp 계산 실패`);
          }

          if (result.amount < benchmarkAmount + ESTIMATE_RULE_SET.displayUnit) {
            throw new Error(
              `${industry.code}, ${employeeCount}명, ${randomUpliftBps}bp가 benchmark를 초과하지 않음`,
            );
          }

          if (result.amount > ESTIMATE_RULE_SET.maxDisplayAmount) {
            throw new Error(
              `${industry.code}, ${employeeCount}명, ${randomUpliftBps}bp가 표시 상한 초과`,
            );
          }
        }
      }
    }
  });

  it("동일 입력과 동일 난수에서 동일한 결과를 반환한다", () => {
    const input = {
      industryCode: "software_it",
      employeeCount: 10,
      randomUpliftBps: 200,
    };

    expect(calculateEstimate(input)).toEqual(calculateEstimate(input));
  });

  it("v2의 21개 업종을 대응한 v1 benchmark 그룹과 같은 금액으로 계산한다", () => {
    for (const industry of ESTIMATE_RULE_SET_V2.industries) {
      const v2Result = calculateEstimate({
        industryCode: industry.code,
        employeeCount: 10,
        randomUpliftBps: 200,
        ruleVersion: ESTIMATE_RULE_V2_VERSION,
      });
      const v1Result = calculateEstimate({
        industryCode: industry.benchmarkGroupCode,
        employeeCount: 10,
        randomUpliftBps: 200,
      });

      expect(v2Result).toMatchObject({
        status: "calculated",
        amount: v1Result.status === "calculated" ? v1Result.amount : undefined,
        ruleVersion: ESTIMATE_RULE_V2_VERSION,
      });
    }
  });

  it("지원하지 않는 규칙 version은 현재 규칙으로 fallback하지 않는다", () => {
    expect(
      calculateEstimate({
        industryCode: "software_it",
        employeeCount: 10,
        randomUpliftBps: 200,
        ruleVersion: "estimate-rule-unknown",
      }),
    ).toEqual({ status: "unsupported", reason: "unsupported_rule_version" });
  });

  it("다른 난수는 승인 범위 안에서 다른 금액을 만들 수 있다", () => {
    const minimum = calculateEstimate({
      industryCode: "software_it",
      employeeCount: 10,
      randomUpliftBps: 100,
    });
    const maximum = calculateEstimate({
      industryCode: "software_it",
      employeeCount: 10,
      randomUpliftBps: 300,
    });

    expect(minimum).toMatchObject({ status: "calculated", amount: 1_260_000 });
    expect(maximum).toMatchObject({ status: "calculated", amount: 1_280_000 });
    expect(minimum).not.toEqual(maximum);
  });

  it("지원하지 않는 업종은 fallback 금액 없이 거절한다", () => {
    expect(
      calculateEstimate({
        industryCode: "unknown",
        employeeCount: 10,
        randomUpliftBps: 200,
      }),
    ).toEqual({ status: "unsupported", reason: "unsupported_industry" });
  });

  it.each([
    [0, "employee_count_out_of_range"],
    [-1, "employee_count_out_of_range"],
    [6_001, "employee_count_out_of_range"],
    [1.5, "employee_count_not_integer"],
    ["10" as unknown as number, "employee_count_not_integer"],
  ])("잘못된 사원 수 %s를 거절한다", (employeeCount, reason) => {
    expect(
      calculateEstimate({
        industryCode: "software_it",
        employeeCount,
        randomUpliftBps: 200,
      }),
    ).toEqual({ status: "invalid", reason });
  });

  it.each([
    [99, "random_uplift_out_of_range"],
    [301, "random_uplift_out_of_range"],
    [100.5, "random_uplift_not_integer"],
    ["200" as unknown as number, "random_uplift_not_integer"],
  ])("잘못된 난수 %s를 거절한다", (randomUpliftBps, reason) => {
    expect(
      calculateEstimate({
        industryCode: "software_it",
        employeeCount: 10,
        randomUpliftBps,
      }),
    ).toEqual({ status: "invalid", reason });
  });

  it("가장 큰 승인 입력도 100억 원 이하의 계산 결과를 반환한다", () => {
    expect(
      calculateEstimate({
        industryCode: "construction_engineering",
        employeeCount: 6_000,
        randomUpliftBps: 300,
      }),
    ).toMatchObject({ status: "calculated", amount: 9_857_100_000 });
  });
});
