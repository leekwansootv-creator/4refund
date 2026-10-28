import { readNewsRecords, readNewsSnapshots } from "./reader";
import { publicFeed } from "../../news-insights/src/model";

/** 익명 방문자에게 게시된 카드 네 필드만 반환한다. 쓰기·관리 RPC·원문 수집은 없다. */
export function doGetNews(event: GoogleAppsScript.Events.DoGet) {
  let value: unknown;
  try {
    if (
      Object.keys(event.parameters).join() !== "view" ||
      event.parameters.view?.length !== 1 ||
      event.parameter.view !== "news"
    )
      throw new Error("지원하지 않는 요청");
    value = publicFeed(readNewsRecords(), readNewsSnapshots());
  } catch {
    value = { error: "NEWS_UNAVAILABLE" };
  }
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
