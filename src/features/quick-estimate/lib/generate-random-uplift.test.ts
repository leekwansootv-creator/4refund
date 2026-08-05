import { describe, expect, it, vi } from "vitest";

import type { RandomUpliftSource } from "./generate-random-uplift";
import { generateRandomUpliftBps } from "./generate-random-uplift";

function createSource(...values: number[]): RandomUpliftSource {
  let index = 0;

  return {
    getRandomValues(buffer) {
      const value = values[index];

      if (value === undefined) {
        throw new Error("테스트 난수 값이 부족합니다.");
      }

      buffer[0] = value;
      index += 1;
      return buffer;
    },
  };
}

describe("generateRandomUpliftBps", () => {
  it("uint32 값 0을 승인된 최솟값 100bp로 변환한다", () => {
    expect(generateRandomUpliftBps(createSource(0))).toBe(100);
  });

  it("uint32 값 200을 승인된 최댓값 300bp로 변환한다", () => {
    expect(generateRandomUpliftBps(createSource(200))).toBe(300);
  });

  it("균등 분배되지 않는 uint32 끝 구간을 버리고 다시 추출한다", () => {
    const source = createSource(0xffff_ffff, 0);
    const spy = vi.spyOn(source, "getRandomValues");

    expect(generateRandomUpliftBps(source)).toBe(100);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("주입한 여러 uint32 값을 100~300bp 정수로 제한한다", () => {
    for (const value of [1, 100, 201, 12_345, 1_000_000, 4_000_000_000]) {
      const result = generateRandomUpliftBps(createSource(value));

      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(100);
      expect(result).toBeLessThanOrEqual(300);
    }
  });
});
