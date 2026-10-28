import { authorizeNewsEditor, googleNewsPort } from "./google";
import { newsService, type NewsCommand } from "./service";
import { SIDEBAR_HTML } from "./sidebar";

function result<T>(operation: () => T) {
  try {
    return { ok: true as const, data: operation() };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const safe =
      /^(다른 편집이|이미 등록된|게시하려면|아직 게시하지|제목은|올바른 공개|HTTP\(S\)|공개 도메인|이미지 후보가|수집 서비스 주소|가져오지 못했습니다|뉴스 관리 권한|뉴스 탭의|뉴스 날짜|뉴스 상태|뉴스 열|뉴스 버전|게시본 연결|게시본 참조|게시본 저장 용량|다른 작업이)/u.test(
        detail,
      );
    return {
      ok: false as const,
      message:
        safe && detail.length < 200
          ? detail
          : "뉴스 작업을 완료하지 못했습니다. 목록을 새로고침하여 저장 여부와 뉴스 설정을 확인해 주세요.",
    };
  }
}

/** 뉴스 메뉴를 정의한다. 신규 뉴스 전용 bound bundle의 onOpen wrapper가 호출한다. */
export function onOpenNews() {
  SpreadsheetApp.getUi()
    .createMenu("뉴스·인사이트")
    .addItem("기사 관리", "showNewsSidebar")
    .addToUi();
}
/** 시트 사용자 실행에서만 사이드바를 연다. 공개 웹 앱은 관리 화면을 제공하지 않는다. */
export function showNewsSidebar() {
  authorizeNewsEditor();
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(SIDEBAR_HTML).setTitle("뉴스·인사이트"),
  );
}
/** 관리 목록은 매 호출마다 현재 문서와 명시 허용 계정을 검증한다. */
export function newsList() {
  return result(() => newsService(googleNewsPort()).list());
}
/** 클라이언트가 임의 메서드·셀 주소·게시 상태를 직접 기록할 수 없는 제한된 RPC다. */
export function newsMutate(value: unknown) {
  return result(() => {
    authorizeNewsEditor();
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      JSON.stringify(value).length > 6000
    )
      throw new Error("잘못된 요청");
    const input = value as Record<string, unknown>;
    if (
      Object.keys(input).some(
        (key) => !["action", "id", "etag", "url", "title", "imageChoice"].includes(key),
      ) ||
      Object.values(input).some((entry) => typeof entry !== "string")
    )
      throw new Error("잘못된 요청");
    return newsService(googleNewsPort()).execute(input as NewsCommand);
  });
}
