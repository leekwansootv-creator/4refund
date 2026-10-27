import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CenterLeaderProfile } from "./center-leader-profile";

describe("센터 인물 소개", () => {
  it("두 소개의 경력·사진·역할을 분리하고 긴 경력을 생략하지 않는다", () => {
    const longCredential = "긴 경력 설명 ".repeat(30);
    render(
      <>
        <CenterLeaderProfile
          heading="센터장"
          name="검증용 센터장"
          role="노무사"
          credentials={["첫 경력"]}
          image={{ src: "/one.png", position: "left" }}
        />
        <CenterLeaderProfile
          heading="부센터장"
          name="검증용 부센터장"
          role="세무사"
          credentials={[longCredential]}
          image={{ src: "/two.png", position: "right" }}
        />
      </>,
    );
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "센터장 검증용 센터장" })).toHaveAttribute(
      "src",
      expect.stringContaining("one.png"),
    );
    expect(screen.getByRole("img", { name: "부센터장 검증용 부센터장" })).toHaveAttribute(
      "src",
      expect.stringContaining("two.png"),
    );
    expect(screen.getByText(longCredential.trim())).toBeInTheDocument();
  });
});
