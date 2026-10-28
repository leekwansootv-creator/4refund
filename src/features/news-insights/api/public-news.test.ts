// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicNews, newsEndpoint, parsePublicNews } from "./public-news";

const endpoint = "https://script.google.com/macros/s/TEST-NEWS/exec?view=news";
const article = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "게시 제목",
  url: "https://news.example.org/article",
  imageUrl: null,
};
afterEach(() => vi.unstubAllGlobals());

describe("Google 공개 뉴스 계약", () => {
  it.each([
    "https://evil.org/exec?view=news",
    endpoint + "&token=secret",
    endpoint + "#x",
    endpoint.replace("https:", "http:"),
    endpoint.replace("?view=news", ""),
  ])("잘못된 공급 주소를 거절한다: %s", (url) => {
    expect(() => newsEndpoint(url)).toThrow();
  });
  it("0/1/2/3개와 이미지 없음 상태를 검증한다", () => {
    for (const count of [0, 1, 2, 3]) {
      const articles = Array.from({ length: count }, (_, i) => ({
        ...article,
        id: article.id.slice(0, -1) + i,
      }));
      expect(parsePublicNews({ articles })).toEqual(articles);
    }
  });
  it.each([
    { ...article, status: "게시" },
    { ...article, title: "" },
    { ...article, title: "가".repeat(301) },
    { ...article, url: "javascript:alert(1)" },
    { ...article, url: "http://127.0.0.1/" },
    { ...article, imageUrl: "https://unreviewed.example.org/image.jpg" },
    { ...article, imageUrl: "data:image/svg+xml;base64,AAA=" },
  ])("초과 필드·잘못된 공개 값을 거절한다", (entry) => {
    expect(() => parsePublicNews({ articles: [entry] })).toThrow();
  });
  it("중복·4건 초과·오류 응답을 빈 목록과 구분한다", () => {
    expect(() => parsePublicNews({ articles: [article, article] })).toThrow();
    expect(() => parsePublicNews({ articles: Array(4).fill(article) })).toThrow();
    expect(() => parsePublicNews({ error: "NEWS_UNAVAILABLE" })).toThrow();
  });
  it("Google 리다이렉트의 JSON을 읽고 자격 증명을 생략한다", async () => {
    const response = new Response(JSON.stringify({ articles: [article] }), {
      headers: { "Content-Type": "application/json" },
    });
    Object.defineProperty(response, "url", {
      value: "https://script.googleusercontent.com/macros/echo?content=opaque",
    });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPublicNews(endpoint, new AbortController().signal)).toEqual([article]);
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer",
      }),
    );
  });
  it.each(["origin", "mime", "size", "declared-size", "malformed", "status"])(
    "%s 실패 응답을 거절한다",
    async (kind) => {
      const response = new Response(
        kind === "size"
          ? "a".repeat(384 * 1024 + 1)
          : kind === "malformed"
            ? "{"
            : '{"articles":[]}',
        {
          status: kind === "status" ? 500 : 200,
          headers: {
            "content-type": kind === "mime" ? "text/html" : "application/json",
            ...(kind === "declared-size" ? { "content-length": "999999" } : {}),
          },
        },
      );
      Object.defineProperty(response, "url", {
        value: kind === "origin" ? "https://evil.org/" : endpoint,
      });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(fetchPublicNews(endpoint, new AbortController().signal)).rejects.toThrow();
    },
  );
});
