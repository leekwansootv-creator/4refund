/** 게시 공급자가 검토를 마친 값만 전달하는 공개 카드 표시 계약이다. 관리 필드를 받지 않는다. */
export type NewsArticle = Readonly<{
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
}>;

/** 미연결, 로딩, 실패, 성공 0건을 구분해 미연결을 조회 성공으로 보고하지 않는다. */
export type NewsInsightsState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; articles: readonly NewsArticle[] };
