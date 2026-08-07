import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuickEstimateHeroSection } from "./quick-estimate-hero-section";
import { QuickEstimateHeroAction } from "@/features/quick-estimate";
import { LANDING_CONTENT } from "../constants/landing-content";

describe("QuickEstimateHeroSection", () => {
  it("별도 페이지 이동 없이 견적 action과 한 벌의 환급 사례를 조합한다", () => {
    render(<QuickEstimateHeroSection action={<QuickEstimateHeroAction />} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: LANDING_CONTENT.refundCases.heading,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "환급액 조회하기" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );

    const casesRegion = screen.getByRole("region", { name: "환급 사례 자동 이동 목록" });
    expect(within(casesRegion).getAllByRole("listitem")).toHaveLength(
      LANDING_CONTENT.refundCases.items.length,
    );
  });
});
