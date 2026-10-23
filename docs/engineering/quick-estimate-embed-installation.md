# 예상 환급액 조회 외부 삽입 설치 가이드

이 가이드는 **구현·자동 테스트를 마친 출시 준비용 설치 계약**이다. 저장소 출하와 운영 공개는 별개이며 Apps Script 웹앱 배포, 실제 접수·알림 확인, 공개 호스팅 반영은 남아 있다. 새 계정의 빈 시트 준비는 [준비 기록](../operations/quick-estimate-miningdev8-preparation.md)의 후속 검증 절을 따른다. 아래 `widget.example.invalid`는 설명용 주소이며 실제 제공 URL로 교체한 뒤 전달해야 한다. 배포 실행과 증적 기준은 [출시·복구 절차](../operations/quick-estimate-embed-release.md), 외부 전달 범위는 [제휴사 전달 안내](quick-estimate-embed-partner-handoff.md)를 따른다.

## 제휴사에 전달할 기본 코드

```html
<div id="fourrefund-estimate">
  <a
    href="https://widget.example.invalid/embed/quick-estimate.html?mode=standalone"
    target="_blank"
    rel="noopener noreferrer"
    >예상 환급액 조회하기</a
  >
</div>
<script
  async
  src="https://widget.example.invalid/embed/v1/loader.js"
  data-target="fourrefund-estimate"
></script>
```

외부 개발자는 원하는 위치에 코드를 넣고 가로 320px 이상의 공간을 제공한다. 저장소·npm·React·Google 시트·Apps Script를 별도로 설치하지 않는다. UI와 수정·업데이트·복구는 포리펀드에서 관리한다. iframe 내부에서 최종 상담 신청만 기존 중앙 접수 시스템으로 전송하며, 제휴사 페이지에 연락처·동의·신청 ID·예상액을 전달하지 않는다.

- HTTPS 최상위 페이지를 기본 지원한다. 중첩 iframe 내부의 CMS나 보안 origin이 없는 환경은 일반 링크 대안을 사용한다.
- 부모 CSP의 `script-src`, `frame-src`, `style-src`에 제공받은 위젯 origin을 각각 허용한다. loader의 shell stylesheet도 같은 origin이다. `*`나 `unsafe-inline`을 추가할 필요는 없다. 부모의 `connect-src`에 Google을 허용하는 방식으로 해결하지 않는다.
- 진입 iframe과 모달 shell은 Shadow DOM 안에 배치한다. 실제 조회·상담 화면의 CSS·폰트·이미지는 우리 iframe에서 로드한다. 실제 제휴 CMS가 script·iframe·stylesheet를 삭제하는지는 설치 시 확인한다.
- script가 차단되어도 원래 링크가 남는다. 준비 응답이 15초 안에 없으면 실패 안내와 별도 페이지 링크를 표시한다. 네트워크가 복구되면 페이지를 새로 고치거나 모달을 닫고 다시 연다.
- iframe 재로드·탐색·준비 시간 초과가 발생한 세션은 자동 복원하지 않는다. 실패 뒤 늦게 도착한 응답도 무시한다. 신청 시도 후 연결이 끊긴 화면은 접수 여부 미확인 경고를 거쳐 닫으며, 새 요청으로 자동 전환하지 않는다.
- 조회·재조회·단계 이동은 접수하지 않는다. `상세 견적 신청하기`만 제출한다. 확인되지 않은 요청은 같은 화면에서 `접수 다시 시도`를 사용한다. 페이지 재로드는 같은 request ID를 보존하지 않으므로 먼저 닫기 경고를 확인한다.

`data-diagnostic="1"`을 컨테이너에 붙이면 진입 화면에 release·출처 origin·수집 방법을 표시한다. 진단은 저장 요청을 보내지 않으며 query·path·연락처를 출력하지 않는다. 정상 script 설치에서는 부모의 실제 message origin을 사용하고, 전달된 `siteOrigin` 문자열을 인증 비밀로 취급하지 않는다.

## script 불가 환경과 조회 데모

```html
<iframe
  src="https://widget.example.invalid/embed/quick-estimate.html?mode=inline"
  title="포리펀드 예상 환급액 조회"
  width="100%"
  height="760"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
<a
  href="https://widget.example.invalid/embed/quick-estimate.html?mode=standalone"
  target="_blank"
  rel="noopener noreferrer"
  >넓은 화면에서 조회하기</a
>
```

iframe-only는 iframe 내부에서 스크롤하고 부모 전체를 덮지 않는다. 출처는 referrer 정책에 따라 미확인이 될 수 있다. 일반 링크의 명시적 `site_origin`은 `configured` 전달값이며 관측된 설치 origin과 구분한다. 전체 경로·캠페인·이전 방문 이력을 수집하지 않는다.

`/embed/demo.html`은 **조회 전용** 예시다. 내부 iframe의 `demo=1`은 신청 endpoint를 비활성화한다. 데모에서 모의 성공을 실제 접수 완료처럼 보여주지 않는다.

## SPA와 여러 인스턴스

loader를 한 번 로드한 뒤 `window.FourRefundEmbed.mount(containerElement)`로 설치한다. 같은 컨테이너는 같은 인스턴스를 반환한다. 반환 객체의 `unmount()`가 `true`이면 정리가 끝났으므로 컨테이너를 제거할 수 있다. 모달이 열려 있으면 닫기 판단을 요청하고 `false`를 반환한다. 제출 중·미확인 경고가 처리되어 모달이 닫힌 뒤 다시 호출한다. `false` 상태에서 컨테이너를 강제로 제거하지 않는다. 동시에 하나의 부모 모달만 연다.

한 페이지에서는 하나의 loader release를 사용한다. 서로 다른 release를 혼합 설치하는 것은 지원하지 않는다. pinned 버전은 `/embed/releases/1.0.0/loader.js`처럼 정확한 버전 URL을 제공한다.

## 우리가 만드는 정적 산출물

- `npm run dev`, `npm run build`, 일반 E2E 빌드는 작은 loader와 CSS를 `public/embed/v1/`에 생성한다. 이 디렉터리는 생성물이며 Git 추적 대상이 아니다.
- 일반 `out/`은 로컬 개발·단일 export용이다. 고정 버전 보존을 보장하는 외부 제공 후보는 `npm run build:embed-release`로 별도 조립한다.
- `EMBED_ARTIFACT_DIRECTORY`는 새 로컬 디렉터리여야 한다. 기본값은 `.embed-artifacts/candidate`다. 기존 디렉터리를 자동 삭제·덮어쓰기하지 않는다.
- `PAGES_BASE_PATH`는 원래 사이트 prefix, `EMBED_RELEASE`는 새 불변 release ID다. release 전용 prefix로 Next.js를 다시 빌드해 HTML·chunks·이미지·폰트의 실제 참조도 고정한다. 단순 파일 이동으로 버전 경로를 바꾸지 않는다.
- `NEXT_PUBLIC_SITE_ORIGIN`과 `NEXT_PUBLIC_SITE_BASE_PATH`는 공식 홈페이지 문의 주소를 결정한다. 명시한 site base(빈 문자열인 루트 포함)는 release 빌드에서도 보존하며, 미설정일 때만 원래 `PAGES_BASE_PATH`를 기본값으로 사용한다. origin 미설정 시 같은 호스트를 사용하므로 별도 위젯 호스트에서는 공식 origin과 실제 site base를 지정해야 한다.
- `EMBED_PUBLIC_BASE_URL`은 실제 제공할 HTTPS origin과 원래 prefix를 포함한다. 미설정 로컬 후보는 설명용 `widget.example.invalid`를 사용하므로 운영 검사에서 거절된다.
- `NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL`은 release 빌드와 운영 검증 시 프로세스 환경 변수로 명시한다. 빌드에서 생략하면 빈 값을 사용해 `.env.local`의 운영 주소를 암묵적으로 포함하지 않는다. 로컬 검증에는 테스트 주소 또는 빈 값을 사용한다.
- `EMBED_PREVIOUS_ARTIFACT`는 `embed-deployment.json`을 포함한 전체 직전 배포본이다. 홈페이지·모든 release·채널의 hash와 basePath를 검증한 뒤 고정 버전과 홈페이지의 이전 `_next/static/` 파일을 함께 보존한다. 동일 자원 경로의 내용 충돌은 중단한다. 같은 release ID를 다시 만들면 실패한다. 새 수정에는 새 ID를 사용한다. 과거 도구로 만든 개별 release 폴더만으로 전체 배포본을 대신하지 않는다.
- manifest에는 source SHA, dirty 여부, protocol, 제출·고지·계산 버전, HTML 경로, 자원 SHA-256이 들어간다. 로컬 수정은 `dirty: true`로 표시한다.
- 기본 채널 loader는 검증된 pinned loader를 로드한다. `--verify`는 전체 배포본을 검증하고 `--production`을 더하면 미커밋·설명용 주소 후보, 접수 불가·테스트 설정, 운영 endpoint와 접수 설정 해시가 다른 홈페이지·고정 버전을 거절한다. 이전 로컬 archive에 접수 설정 증거가 없으면 공개용으로 사용할 수 없다.
- `--rollback`은 `EMBED_PREVIOUS_ARTIFACT`의 현재 버전을 모두 유지하면서 `EMBED_ROLLBACK_ARTIFACT`의 홈페이지와 채널을 **새** `EMBED_ARTIFACT_DIRECTORY`에 복구한다. 원본 archive는 수정하지 않는다. 봉인된 배포본에 기존 `--activate`만 적용하는 작업은 거절한다.
- `embed/partner/`에는 기본 설치·버전 고정·iframe 코드, README와 조회 전용 demo를 자동 생성한다. demo는 `demo=1`을 사용해 접수를 열지 않는다. iframe 방식임을 명시하며 기본 script의 부모 전체 모달과 구분한다.
- `npm run test:embed-release`는 해당 배포본의 홈페이지·기본 채널·보존된 모든 고정 버전·데모를 1440px/375px Chromium에서 확인한다. `EMBED_BROWSER_PREVIOUS_ARTIFACT`가 있으면 직전 홈페이지 HTML이 새 배포 자원을 사용하는 경우도 확인한다. 모든 요청을 로컬 파일로 처리하고 POST·누락 자원·브라우저 오류가 있으면 실패한다.

workflow는 `quality.yml`의 자동 배포를 분리하고 `embed-release.yml`의 수동 실행에서 조립한 전체 배포본만 올린다. 저장소 반영만으로 배포하지 않는다. 운영 확인값, 직전 공개 manifest와 archive의 일치, artifact 무결성과 브라우저 검증을 통과해야 업로드 단계에 도달한다. 일반 `out/`만 업로드하지 않는다. Actions archive에는 보존 기한이 있으므로 매 공개 시 전체 묶음을 별도로 보관한다. 만료·누락을 최초 배포로 우회하지 않는다.

## 서버 호환 설정과 공개 순서

1. 구·신 요청을 지원하는 Apps Script 소스를 준비하고 기존 v1 홈페이지 동작을 확인한다.
2. 승인된 운영 변경에서 `migrateQuickEstimateAttribution()`을 실행한다. 함수는 원본 25–29열, 상담 17–18열, codebook·보호·필터를 확장한다. 원본 1–24열과 상담 1–16열을 보존한다. `setupQuickEstimateStorage()` 반복은 migration을 대체하지 않는다.
3. `QUICK_ESTIMATE_ATTRIBUTION_SCHEMA=2`는 migration의 readback 성공 후에만 함수가 기록한다. `pending`이면 v2 쓰기가 닫힌다. 중간 실패는 같은 함수를 재실행해 복구한다. 이 값을 수동으로 강제 활성화하지 않는다.
4. `QUICK_ESTIMATE_HOMEPAGE_ORIGINS`에 공식 origin을 쉼표로 구분해 지정한다. `NEXT_PUBLIC_SITE_ORIGIN`과 일치시킨다. 일반 외부 출처는 HTTPS DNS host·기본 port를 받는다. 예외 origin은 서버의 `QUICK_ESTIMATE_ALLOWED_SOURCE_ORIGINS`와 빌드의 `NEXT_PUBLIC_EMBED_ALLOWED_ORIGINS`에 동일하게 명시한다. localhost·HTTP 예외는 자동 테스트 외에 임의로 사용하지 않는다.
5. 별도 승인된 Google 연동·고지·호스팅·용량·브라우저 확인을 마친 다음에만 프런트와 loader를 공개한다. 기존 서버 A는 v2를 거절하므로 프런트부터 배포하지 않는다.

`QUICK_ESTIMATE_RATE_LIMITS`는 서버 소유 JSON `{ "minute": 10, "daily": 100, "contactHourly": 3 }` 형태다. 양의 정수 세 개만 허용하고 누락·잘못된 설정은 호환 보호값 10/100/3을 사용한다. 이 값은 측정된 최대 처리량이 아니다. 측정 후 상향할 수 있지만 모든 설치 사이트가 공유한다. 시트 저장과 MailApp quota는 별개이며 알림 실패가 이미 저장된 원본 성공을 취소하지 않는다.

롤백은 기본 loader·프런트만 이전 호환 release로 전환한다. 확장 컬럼과 신규 데이터는 유지하고 호환 서버 B를 유지한다. v2 접수 이후 구형 24열 전용 코드 A로 돌아가지 않는다. 기존 탭·캐시·고정 release의 요청이 계속 올 수 있다.

migration은 기존 행 수·순서·원본·업무값이 readback과 다르면 활성화하지 않는다. 새 출처 열의 편집자는 실행 계정과 Spreadsheet 소유자로 제한하고, 기존 범위 권한은 보존한다. 실행 계정 식별이 없거나 필터가 A1에서 시작하는 기존 16열/확장 18열 형태가 아니면 첫 쓰기 전에 중단한다. 이 검사는 유지보수 구간의 수동 편집 중단 안내를 대체하지 않는다.

실행 계정 확인에는 `Session.getEffectiveUser()`의 `userinfo.email` OAuth scope가 필요해 로컬 `appsscript.json`에도 선언했다. 별도로 승인된 운영 전환 시 manifest 반영과 운영 실행 계정의 재인증을 먼저 확인해야 한다. 방문자 로그인·이메일 자동 수집을 추가하는 설정은 아니며, 이번 로컬 작업에서 Google 계정 권한을 부여하거나 변경하지 않았다.

## 검증 범위

일반 자동 검사는 로컬 정적 서버와 모의 HTTPS 제휴 origin, 가짜 Sheet·메일 port를 사용한다. 실제 Google POST는 가로채거나 차단한다. Chromium 검증은 iOS Safari·Android 실기기·제휴 CMS의 지원 보증이나 Google 처리 용량 측정을 대체하지 않는다. 확인한 자동 검사 결과는 [기획 문서의 로컬 구현 기록](../planning/quick-estimate-embed-plan.md#로컬-구현과-자동-검증-기록)에 기록한다.
