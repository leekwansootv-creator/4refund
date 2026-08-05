import { describe, expect, it } from "vitest";

import { ESTIMATE_RULE_SET } from "./estimate-rule-set";

describe("ESTIMATE_RULE_SET", () => {
  it("승인된 버전과 전체 입력 범위를 고정한다", () => {
    expect(ESTIMATE_RULE_SET).toMatchObject({
      benchmarkVersion: "incruit-2026-08-05",
      currency: "KRW",
      displayUnit: 10_000,
      employeeCount: { max: 6_000, min: 1 },
      maxDisplayAmount: 10_000_000_000,
      randomUpliftBps: { max: 300, min: 100 },
      version: "estimate-rule-2026-08-05",
    });
  });

  it("14개 업종의 내부 code와 label을 중복 없이 보유한다", () => {
    const codes = ESTIMATE_RULE_SET.industries.map(({ code }) => code);
    const labels = ESTIMATE_RULE_SET.industries.map(({ label }) => label);

    expect(ESTIMATE_RULE_SET.industries).toHaveLength(14);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("각 기준액은 benchmark에 5%를 더해 1,000원 단위로 올린 값이다", () => {
    for (const industry of ESTIMATE_RULE_SET.industries) {
      const expectedBaseRate =
        Math.ceil((industry.benchmarkRatePerEmployee * 1.05) / 1_000) * 1_000;

      expect(industry.baseRatePerEmployee).toBe(expectedBaseRate);
    }
  });

  it("6,000명과 300bp에서도 모든 업종이 100억 원 상한 안에 있다", () => {
    const { displayUnit, employeeCount, maxDisplayAmount, randomUpliftBps } = ESTIMATE_RULE_SET;

    const maximumAmounts = ESTIMATE_RULE_SET.industries.map(
      ({ baseRatePerEmployee }) =>
        Math.ceil(
          (baseRatePerEmployee * employeeCount.max * (10_000 + randomUpliftBps.max)) /
            (10_000 * displayUnit),
        ) * displayUnit,
    );

    expect(Math.max(...maximumAmounts)).toBe(9_857_100_000);
    expect(maximumAmounts.every((amount) => amount <= maxDisplayAmount)).toBe(true);
  });
});
