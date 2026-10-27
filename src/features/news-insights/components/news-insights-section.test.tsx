import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewsInsightsSection } from "./news-insights-section";
import type { NewsArticle } from "../types/news-insights";

function articles(count: number): NewsArticle[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `fixture-${index}`,
    title: `개발 검증용 기사 ${index + 1}`,
    url: `https://example.com/articles/${index}`,
    imageUrl: null,
  }));
}

describe("뉴스 공개 카드", () => {
  it("미연결 상태에는 성공 안내나 예시 기사를 노출하지 않는다", () => {
    const { container } = render(<NewsInsightsSection state={{ status: "unconfigured" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("게시 0건은 숨기고 로딩과 조회 실패는 서로 구분한다", () => {
    const { container, rerender } = render(
      <NewsInsightsSection state={{ status: "ready", articles: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<NewsInsightsSection state={{ status: "loading" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("불러오고 있습니다");
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    rerender(<NewsInsightsSection state={{ status: "error" }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("불러오지 못했습니다");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([1, 2, 3, 5])("%i건에서 실제 게시 카드만 최대 3건 표시한다", (count) => {
    render(<NewsInsightsSection state={{ status: "ready", articles: articles(count) }} />);
    expect(screen.getAllByRole("link")).toHaveLength(Math.min(count, 3));
    expect(screen.queryByText("개발 검증용 기사 4")).not.toBeInTheDocument();
  });

  it("긴 제목과 HTML처럼 보이는 문자열을 전체 링크 이름의 텍스트로 보존한다", () => {
    const title = "매우 긴 제목 ".repeat(35) + '<script>alert("test")</script>';
    render(
      <NewsInsightsSection
        state={{ status: "ready", articles: [{ ...articles(1)[0]!, title }] }}
      />,
    );
    const link = screen.getByRole("link", { name: `${title} (새 창)` });
    expect(link).toHaveAttribute("href", "https://example.com/articles/0");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.querySelector("script")).toBeNull();
  });

  it("이미지 없음과 로드 실패에 같은 기본 이미지를 표시하고 URL 교체는 다시 시도한다", () => {
    const [article] = articles(1);
    if (!article) throw new Error("fixture missing");
    const { container, rerender } = render(
      <NewsInsightsSection state={{ status: "ready", articles: [article] }} />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/news/article-fallback.png",
    );
    rerender(
      <NewsInsightsSection
        state={{
          status: "ready",
          articles: [{ ...article, imageUrl: "https://example.com/one.jpg" }],
        }}
      />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/news/article-fallback.png",
    );
    rerender(
      <NewsInsightsSection
        state={{
          status: "ready",
          articles: [{ ...article, imageUrl: "https://example.com/two.jpg" }],
        }}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/two.jpg");
  });

  it("조회 실패 재시도는 명시적인 버튼 조작으로만 호출한다", () => {
    const retry = vi.fn();
    render(<NewsInsightsSection state={{ status: "error" }} onRetry={retry} />);
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
