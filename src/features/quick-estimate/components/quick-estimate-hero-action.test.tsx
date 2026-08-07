import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuickEstimateHeroAction } from "./quick-estimate-hero-action";

describe("QuickEstimateHeroAction", () => {
  it("route 이동이 아닌 dialog trigger로 click 사건을 전달한다", () => {
    const onClick = vi.fn();
    render(<QuickEstimateHeroAction onClick={onClick} />);

    const trigger = screen.getByRole("button", { name: "환급액 조회하기" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    trigger.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
