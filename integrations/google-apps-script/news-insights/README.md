# 뉴스·인사이트 Apps Script

시트 사이드바의 URL 초안·후보 수집·수동 수정·미리보기·게시·숨김을 소유한다.
외부 수집은 `services/news-extractor`에 위임한다. CMS·상담·leads·codebook은 참조하지 않는다.

## 로컬 검증

```powershell
npm run build:apps-script
npm run check:apps-script
$env:QUICK_ESTIMATE_LIVE_E2E = '0'
npm run check
```

`Code.gs`는 TypeScript에서 생성하며 직접 수정하지 않는다. manifest는 신규 뉴스 전용 bound
프로젝트용이며 HTTP 진입점과 webapp 설정이 없다. 기존 신청 프로젝트에 덮어쓰지 않는다.

## 승인 후 설정

| ScriptProperty       | 관리 프로젝트               | 별도 공개 프로젝트 |
| -------------------- | --------------------------- | ------------------ |
| NEWS_SPREADSHEET_ID  | 지정 문서 ID                | 동일 문서 ID       |
| NEWS_EDITOR_EMAILS   | 명시 허용 이메일, 쉼표 구분 | 설정하지 않음      |
| NEWS_EXTRACTOR_URL   | 고정 HTTPS /extract 주소    | 설정하지 않음      |
| NEWS_EXTRACTOR_TOKEN | 32~256자 임의 ASCII secret  | 설정하지 않음      |

실제 주소·계정·비밀값을 Git에 기록하지 않는다. 소유 계정의 권한을 사용하며 다른 계정에 공유하지 않는다.
Google 문서/스크립트 편집자는 셀과 ScriptProperties에 접근할 수 있으므로 신뢰하는 운영자만 편집자로 둔다.

관리 bundle의 `onOpen` wrapper는 `onOpenNews`를 호출하고 메뉴에서 `showNewsSidebar`를 연다.
이 bundle은 기존 bound script가 없음을 확인한 신규 뉴스 전용 프로젝트에만 설치한다. 기존 script가
있다면 onOpen을 덮어쓰지 않고 메뉴 합성 방법을 별도로 검토한다. 자동 onEdit 수집·HTTP 진입점·
설치형 트리거 생성 함수는 없다.

공개 피드는 [news-public](../news-public/README.md)의 별도 읽기 전용 bundle을 사용한다.
OAuth는 spreadsheets.readonly이며 관리 RPC·쓰기·수집 코드 자체를 포함하지 않는다.
익명 공개/OAuth 변경은 실행 시 권한 범위를 확인하며 CORS·응답 리다이렉트는 실제 배포 후 검증한다.

## 저장 계약

`src/model.ts`의 헤더 순서를 사용한다. 일상 작업은 사이드바에서 하며 실제 설치·게시 상태는
[뉴스 설계의 운영 기록](../../../docs/engineering/news-google-sheets.md)과 현재 Google 화면을 확인한다.

- 뉴스 관리: 17열, 최대 100건. 편집값·후보·상태·etag 기반 동시성.
- 뉴스 게시본: 8열, 최대 300개 불변 스냅샷. 관리 행이 참조하는 게시본만 공개.
- 수집기가 디코드/재인코딩한 JPEG를 48,000자씩 두 셀에 보관한다.
- 편집본 저장·다시 가져오기는 게시본을 바꾸지 않는다. 게시 버튼만 공개 참조를 전환한다.
- 숨김·재게시에서 최초 게시일을 보존한다. 응답 손실은 목록 새로고침 후 상태를 확인한다.
- 용량 초과 시 자동 삭제하지 않는다. 보존 정책은 별도 결정한다.

되돌릴 때 홈페이지 NEXT_PUBLIC_NEWS_API_URL을 제거하고 승인된 절차로 재빌드한다.
기사·스냅샷 행을 삭제하지 않는다. 상세 경계는
[뉴스 설계](../../../docs/engineering/news-google-sheets.md)를 확인한다.
