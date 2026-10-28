import { afterEach, expect, it, vi } from "vitest";
import { readNewsRecords, readNewsSnapshots } from "./reader";
import { createRecord, preparePublication } from "../../news-insights/src/model";
import { doGetNews } from "./entrypoint";

vi.mock("./reader", () => ({
  readNewsRecords: vi.fn(),
  readNewsSnapshots: vi.fn(),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function request(parameters: Record<string, string[]>) {
  const parameter = Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [key, value[0]]),
  );
  return { parameter, parameters } as GoogleAppsScript.Events.DoGet;
}
function output() {
  const text = vi.fn((value: string) => ({ setMimeType: () => JSON.parse(value) as unknown }));
  vi.stubGlobal("ContentService", {
    createTextOutput: text,
    MimeType: { JSON: "application/json" },
  });
}

it("게시 스냅샷의 네 필드만 공개하며 편집본·초안·수집 지문을 노출하지 않는다", () => {
  output();
  const now = "2026-10-28T00:00:00.000Z";
  const source = createRecord(
    "00000000-0000-4000-8000-000000000001",
    "https://news.example.org/a",
    now,
  );
  const publication = preparePublication(
    { ...source, title: "공개 제목" },
    "00000000-0000-4000-8000-000000000002",
    now,
  );
  const draft = createRecord(
    "00000000-0000-4000-8000-000000000003",
    "https://news.example.org/b",
    now,
  );
  vi.mocked(readNewsRecords).mockReturnValue([
    {
      ...publication.record,
      title: "미게시 수정",
      candidateTitle: "비공개 후보",
      fingerprint: "private",
    },
    draft,
  ]);
  vi.mocked(readNewsSnapshots).mockReturnValue([publication.snapshot]);
  expect(doGetNews(request({ view: ["news"] }))).toEqual({
    articles: [{ id: source.id, title: "공개 제목", url: source.url, imageUrl: null }],
  });
});

it.each([{ view: ["news", "news"] }, { view: ["news"], range: ["leads"] }, {}])(
  "불허 쿼리는 시트 읽기 전에 거절한다: %j",
  (parameters) => {
    output();
    expect(doGetNews(request(parameters))).toEqual({ error: "NEWS_UNAVAILABLE" });
    expect(readNewsRecords).not.toHaveBeenCalled();
  },
);

it("읽기 실패 시 원문 예외나 문서 설정을 응답에 포함하지 않는다", () => {
  output();
  vi.mocked(readNewsRecords).mockImplementation(() => {
    throw new Error("private-document-id / configuration");
  });
  expect(doGetNews(request({ view: ["news"] }))).toEqual({ error: "NEWS_UNAVAILABLE" });
});
