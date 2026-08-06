import { ESTIMATE_RULE_SET } from "../constants/estimate-rule-set";

const UINT32_RANGE = 2 ** 32;

/** 테스트에서 결정적인 값을 주입할 수 있는 보안 난수 source 계약입니다. */
export type RandomUpliftSource = {
  getRandomValues(values: Uint32Array): Uint32Array;
};

const browserCryptoSource: RandomUpliftSource = {
  getRandomValues(values) {
    return globalThis.crypto.getRandomValues(values);
  },
};

/**
 * 승인된 100bp부터 300bp 사이의 정수를 보안 난수로 생성합니다.
 *
 * uint32 전체 범위를 구간 크기로 단순 나눈 나머지는 결과별 확률이 달라질 수
 * 있으므로, 균등 분배되지 않는 끝 구간을 버리고 다시 추출합니다.
 */
export function generateRandomUpliftBps(source: RandomUpliftSource = browserCryptoSource): number {
  const { min, max } = ESTIMATE_RULE_SET.randomUpliftBps;
  const outcomeCount = max - min + 1;
  const acceptanceLimit = Math.floor(UINT32_RANGE / outcomeCount) * outcomeCount;
  const values = new Uint32Array(1);

  while (true) {
    source.getRandomValues(values);
    const value = values[0];

    if (value === undefined) {
      throw new Error("보안 난수 source가 uint32 값을 생성하지 않았습니다.");
    }

    if (value < acceptanceLimit) {
      return min + (value % outcomeCount);
    }
  }
}
