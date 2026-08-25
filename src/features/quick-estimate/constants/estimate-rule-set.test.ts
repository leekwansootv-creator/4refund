import { describe, expect, it } from "vitest";

import {
  ESTIMATE_RULE_SET,
  ESTIMATE_RULE_SET_V1,
  ESTIMATE_RULE_SET_V2,
  ESTIMATE_RULE_V1_VERSION,
  ESTIMATE_RULE_V2_VERSION,
  getEstimateRuleSet,
} from "./estimate-rule-set";

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

  it("v2는 N을 첫 번째에 두고 KSIC 대분류 21개를 합의한 순서로 보유한다", () => {
    expect(ESTIMATE_RULE_SET_V2.industries.map(({ code }) => code)).toEqual([
      "N",
      "T",
      "F",
      "O",
      "B",
      "P",
      "U",
      "K",
      "A",
      "G",
      "Q",
      "L",
      "E",
      "I",
      "R",
      "H",
      "D",
      "M",
      "J",
      "C",
      "S",
    ]);
    expect(ESTIMATE_RULE_SET_V2.industries[0]).toMatchObject({
      code: "N",
      label: "용역·파견·시설관리업",
      officialLabel: "사업시설 관리, 사업 지원 및 임대 서비스업",
    });
    expect(new Set(ESTIMATE_RULE_SET_V2.industries.map(({ code }) => code)).size).toBe(21);
    expect(new Set(ESTIMATE_RULE_SET_V2.industries.map(({ label }) => label)).size).toBe(21);
  });

  it("v2의 모든 업종은 기존 benchmark 그룹의 기준액을 그대로 재사용한다", () => {
    const v1Industries = new Map(
      ESTIMATE_RULE_SET_V1.industries.map((industry) => [industry.code, industry]),
    );

    for (const industry of ESTIMATE_RULE_SET_V2.industries) {
      const benchmarkGroup = v1Industries.get(industry.benchmarkGroupCode);

      expect(benchmarkGroup).toBeDefined();
      expect(industry.benchmarkRatePerEmployee).toBe(benchmarkGroup?.benchmarkRatePerEmployee);
      expect(industry.baseRatePerEmployee).toBe(benchmarkGroup?.baseRatePerEmployee);
    }
  });

  it("v1과 v2만 version별 규칙으로 조회한다", () => {
    expect(getEstimateRuleSet(ESTIMATE_RULE_V1_VERSION)).toBe(ESTIMATE_RULE_SET_V1);
    expect(getEstimateRuleSet(ESTIMATE_RULE_V2_VERSION)).toBe(ESTIMATE_RULE_SET_V2);
    expect(getEstimateRuleSet("estimate-rule-unknown")).toBeUndefined();
  });

  it("각 기준액은 benchmark에 5%를 더해 1,000원 단위로 올린 값이다", () => {
    for (const ruleSet of [ESTIMATE_RULE_SET_V1, ESTIMATE_RULE_SET_V2]) {
      for (const industry of ruleSet.industries) {
        const expectedBaseRate =
          Math.ceil((industry.benchmarkRatePerEmployee * 1.05) / 1_000) * 1_000;

        expect(industry.baseRatePerEmployee).toBe(expectedBaseRate);
      }
    }
  });

  it("6,000명과 300bp에서도 모든 업종이 100억 원 상한 안에 있다", () => {
    for (const ruleSet of [ESTIMATE_RULE_SET_V1, ESTIMATE_RULE_SET_V2]) {
      const { displayUnit, employeeCount, maxDisplayAmount, randomUpliftBps } = ruleSet;

      const maximumAmounts = ruleSet.industries.map(
        ({ baseRatePerEmployee }) =>
          Math.ceil(
            (baseRatePerEmployee * employeeCount.max * (10_000 + randomUpliftBps.max)) /
              (10_000 * displayUnit),
          ) * displayUnit,
      );

      expect(Math.max(...maximumAmounts)).toBe(9_857_100_000);
      expect(maximumAmounts.every((amount) => amount <= maxDisplayAmount)).toBe(true);
    }
  });
});
