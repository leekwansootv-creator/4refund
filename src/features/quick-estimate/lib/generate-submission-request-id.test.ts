import { describe, expect, it, vi } from "vitest";

import { generateSubmissionRequestId } from "./generate-submission-request-id";

describe("generateSubmissionRequestId", () => {
  it("주입한 보안 난수 source의 UUID를 그대로 반환한다", () => {
    const randomUUID = vi.fn(() => "0fca3874-40bc-4ea9-a7ad-742a062736ea");

    expect(generateSubmissionRequestId({ randomUUID })).toBe(
      "0fca3874-40bc-4ea9-a7ad-742a062736ea",
    );
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});
