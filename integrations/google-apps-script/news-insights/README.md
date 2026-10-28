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

`Code.gs`는 TypeScript에서 생성하며 직접 수정하지 않는다. manifest는 뉴스 전용 bound 프로젝트용이다.
사이드바 관리 RPC와 HMAC 검증 후 후보만 처리하는 `doPost`를 제공한다. 기존 신청 프로젝트에 덮어쓰지 않는다.

## 승인 후 설정

| ScriptProperty       | 관리 프로젝트                          | 별도 공개 프로젝트 |
| -------------------- | -------------------------------------- | ------------------ |
| NEWS_SPREADSHEET_ID  | 지정 문서 ID                           | 동일 문서 ID       |
| NEWS_EDITOR_EMAILS   | 명시 허용 이메일, 쉼표 구분            | 설정하지 않음      |
| NEWS_EXTRACTOR_URL   | 고정 HTTPS /extract 주소               | 설정하지 않음      |
| NEWS_EXTRACTOR_TOKEN | 32~256자 임의 ASCII secret             | 설정하지 않음      |
| NEWS_COLLECTION_MODE | 대기열 방식은 `github-actions`         | 설정하지 않음      |
| NEWS_WORKER_TOKEN    | 대기열 방식의 64자리 소문자 hex secret | 설정하지 않음      |

`github-actions` 모드에서는 EXTRACTOR_URL/TOKEN이 필요 없다. 작업자는 저장소의
`.github/workflows/news-collection.yml`과 `services/news-extractor/news_extractor/queue_worker.py`를 사용한다.
기존 HTTPS 직접 수집 방식은 MODE가 비어 있을 때만 사용한다.

실제 주소·계정·비밀값을 Git에 기록하지 않는다. 소유 계정의 권한을 사용하며 다른 계정에 공유하지 않는다.
Google 문서/스크립트 편집자는 셀과 ScriptProperties에 접근할 수 있으므로 신뢰하는 운영자만 편집자로 둔다.

관리 bundle의 `onOpen` wrapper는 `onOpenNews`를 호출하고 메뉴에서 `showNewsSidebar`를 연다.
이 bundle은 기존 bound script가 없음을 확인한 신규 뉴스 전용 프로젝트에만 설치한다. 기존 script가
있다면 onOpen을 덮어쓰지 않고 메뉴 합성 방법을 별도로 검토한다. 자동 onEdit 수집과 설치형 트리거는 없다.
셀에 직접 URL만 넣는 대신 **뉴스·인사이트 → 기사 관리 → 새 기사 URL → 초안 만들기·가져오기**를 사용한다.

## 대기열 연결 순서

1. 로컬 검사 후 관리 프로젝트에 생성된 Code.gs를 저장한다. 공개 피드 코드는 변경하지 않는다.
2. 새 작업자 연결 권한을 승인받은 뒤 NEWS_COLLECTION_MODE와 NEWS_WORKER_TOKEN을 설정하고,
   관리 앱을 소유자 실행·익명 POST 웹 앱으로 배포한다. 서명 없는 요청은 대기열을 읽거나 수정하지 못한다.
3. GitHub 저장소 Actions secrets에 NEWS_WORKER_URL(`/exec`)과 같은 NEWS_WORKER_TOKEN을 저장한다.
   저장소 변수 NEWS_COLLECTION_ENABLED=`true`는 코드 검수·main 반영과 연결 검증 준비 후 설정한다.
4. 뉴스 사이드바에서 기존 기사 다시 가져오기를 요청하고 News collection workflow를 실행한다.
   후보만 갱신되고 수동 제목·이미지·게시본·최초 게시일이 유지되는지 확인한다.
5. 후보를 명시적으로 적용하고 편집본 저장·게시·숨김·재게시를 각각 확인한다. 실제 검증 결과는 운영 기록에 추가한다.

5분 간격 예약은 즉시 실행 보장이 없고 GitHub 부하로 지연될 수 있다. 60일간 저장소 활동이 없으면
예약이 비활성화될 수 있다. [GitHub 예약 실행 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)를 참고한다.
수집 상태 조회는 사이드바가 열린 동안 15초마다 수행한다. 1시간 지난 작업은 실패로 표시한다.
필요하면 운영자가 GitHub의 News collection → Run workflow로 실행하고, 실패 상태에서 다시 가져오기를 누른다.

작업자는 한 번에 최대 3건, 각 임대 3분·최대 2회다. HMAC SHA-256, ±5분 시각 검사,
10분 nonce 보존·60건 한도로 재전송을 차단한다. 요청에는 URL/작업 ID/임대 키만 전달하며,
작업자는 편집 제목 변경·게시·숨김·임의 시트 범위 조회를 할 수 없다. 작업자의 수집 자식 프로세스에는
공유 secret을 전달하지 않는다. 중단 시 NEWS_COLLECTION_ENABLED를 false로 바꾸고 필요 시 웹 앱 배포를 보관한다.
기존 게시 카드와 관리·게시본 행은 보존하며, 토큰을 바꿀 때는 양쪽 설정을 함께 변경한다.

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
