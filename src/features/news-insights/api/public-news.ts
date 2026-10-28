import type { NewsArticle } from "../types/news-insights";

const MAX_RESPONSE = 384 * 1024;
const IMAGE_PREFIX = "data:image/jpeg;base64,";
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu;

/** 설정된 Google Apps Script의 공개 뉴스 읽기 URL만 허용한다. 자격 증명은 받지 않는다. */
export function newsEndpoint(value: string): string {
  const url = new URL(value);
  if (
    url.origin !== "https://script.google.com" ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/u.test(url.pathname) ||
    url.search !== "?view=news"
  )
    throw new Error("NEWS_ENDPOINT_INVALID");
  return url.href;
}
function articleUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\]/u.test(value))
    throw new Error("NEWS_INVALID");
  const url = new URL(value);
  if (
    !/^https?:$/u.test(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/u.test(url.hostname) ||
    /\.(?:localhost|local|internal|test)$/u.test(url.hostname)
  )
    throw new Error("NEWS_INVALID");
  return url.href;
}

/** 관리 필드가 섞인 응답도 거절한다. 공개 네 필드의 카드만 표시한다. */
export function parsePublicNews(value: unknown): readonly NewsArticle[] {
  if (!value || typeof value !== "object" || Object.keys(value).join() !== "articles")
    throw new Error("NEWS_INVALID");
  const entries = (value as { articles?: unknown }).articles;
  if (!Array.isArray(entries) || entries.length > 3) throw new Error("NEWS_INVALID");
  const seen = new Set<string>();
  return entries.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Object.keys(entry).sort().join() !== "id,imageUrl,title,url"
    )
      throw new Error("NEWS_INVALID");
    const item = entry as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      seen.has(item.id) ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      [...item.title].length > 300 ||
      /[\u0000-\u001f\u007f]/u.test(item.title)
    )
      throw new Error("NEWS_INVALID");
    seen.add(item.id);
    if (
      item.imageUrl !== null &&
      (typeof item.imageUrl !== "string" ||
        !item.imageUrl.startsWith(IMAGE_PREFIX) ||
        item.imageUrl.length > 95_576 + IMAGE_PREFIX.length ||
        (item.imageUrl.length - IMAGE_PREFIX.length) % 4 !== 0 ||
        !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/u.test(item.imageUrl))
    )
      throw new Error("NEWS_INVALID");
    return {
      id: item.id,
      title: item.title.trim(),
      url: articleUrl(item.url),
      imageUrl: item.imageUrl as string | null,
    };
  });
}

/** 익명 공개 JSON만 제한된 크기·시간으로 읽는다. 기사 원문 수집은 수행하지 않는다. */
export async function fetchPublicNews(
  endpoint: string,
  signal: AbortSignal,
): Promise<readonly NewsArticle[]> {
  const response = await fetch(newsEndpoint(endpoint), {
    signal,
    credentials: "omit",
    cache: "no-store",
    redirect: "follow",
    referrerPolicy: "no-referrer",
    headers: { Accept: "application/json" },
  });
  const final = new URL(response.url);
  if (
    !response.ok ||
    !["https://script.google.com", "https://script.googleusercontent.com"].includes(final.origin) ||
    !response.headers.get("content-type")?.toLowerCase().startsWith("application/json") ||
    !response.body
  )
    throw new Error("NEWS_UNAVAILABLE");
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > MAX_RESPONSE))
    throw new Error("NEWS_TOO_LARGE");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0,
    body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE) throw new Error("NEWS_TOO_LARGE");
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return parsePublicNews(JSON.parse(body));
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
