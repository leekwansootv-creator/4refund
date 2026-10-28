# 뉴스 공개 읽기 Apps Script

`news-insights`의 고정 탭 읽기·검증·게시 투영만 포함하는 별도 배포 프로젝트다.
`Code.gs`는 `npm run build:apps-script`로 생성한다. 기존 신청 프로젝트에 덮어쓰지 않는다.

- Script Property는 `NEWS_SPREADSHEET_ID`만 설정한다.
- OAuth는 `spreadsheets.readonly`만 사용한다. Google의 권한 범위는 계정의 스프레드시트 읽기이며,
  실제 코드는 지정한 문서의 `뉴스 관리`·`뉴스 게시본` 두 탭에만 접근한다.
- 관리자 이메일·수집 토큰·관리 RPC·쓰기 메서드는 배포 bundle에 포함하지 않는다.
- 소유자로 실행하는 익명 웹 앱에서 `GET ?view=news`만 받는다.
- 초안·숨김·게시본 없는 행은 공개하지 않는다. 응답은 최대 3개의 id/title/url/imageUrl이다.
- 실패 시 `NEWS_UNAVAILABLE`만 반환한다. 문서 ID·설정·원문 예외는 노출하지 않는다.

실제 배포 전 OAuth 권한과 익명 공개 범위를 확인한다. 배포 후 익명 GET, 다른 origin의 브라우저
CORS, 3개 사진, 불허 쿼리의 제한 응답을 검증한다. 홈페이지 빌드에는 이 웹 앱 URL과 `?view=news`를
`NEXT_PUBLIC_NEWS_API_URL`로 제공한다. 실제 주소·문서 ID는 Git에 기록하지 않는다.

관리와 공개 프로젝트는 `news-insights/src/model.ts`의 순수 검증·공개 투영만 공유한다.
공개 읽기는 고급 Google Sheets API v4의 고정 범위 조회를 사용한다. manifest의 `Sheets`
서비스를 활성화하며, 쓰기 scope를 요구하는 `SpreadsheetApp.openById`는 사용하지 않는다.
생성물 회귀 검사는 SpreadsheetApp·쓰기·관리·수집 코드가 포함되지 않는지 검사한다.
