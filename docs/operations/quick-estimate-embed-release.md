# 외부 삽입 모듈 출시·복구 절차

## 현재 상태

2026-10-28 새 계정의 서버 활성화와 실제 접수·알림·보유/파기 시험은
[운영 전환 기록](quick-estimate-v2-release-2026-10.md)에 갱신한다. 아래 준비 시점의 상태를
현재 운영 상태로 대신하지 않으며 홈페이지 공개 결과는 해당 실행과 공개 digest로 확인한다.

이 문서와 workflow는 출시 준비 결과이며 저장소 출하와 운영 공개는 별도 단계다. 사용자는 2026-10-23에 현재 변경사항의 검수·PR 출하·병합을 요청했다. 실제 PR·병합 결과는 GitHub 기록으로 확인하고, 이 문서만으로 완료를 추정하지 않는다.

새 계정의 빈 시트 보호·입력 검증·서식·출처 schema 준비와 읽기 검증은 완료했으며 상세 증적은 [신규 환경 준비 기록](quick-estimate-miningdev8-preparation.md)의 후속 검증 절에 있다. 기존 Google 자산, 홈페이지 접수 주소와 조회 전용 로컬 미리보기는 보존한다. Apps Script 웹앱 배포·트리거 설치, 실제 접수·알림, Pages 공개는 아직 별도 운영 단계로 남아 있다.

기본 제공 방식은 우리가 호스팅하는 script + iframe이며 제휴사는 설치 코드만 적용한다. 제휴처 이름·캠페인·계약 기간이 정해지지 않아도 준비할 수 있다. 새 DB, 캠페인 분석, 디자인 변경은 포함하지 않는다.

## 전체 배포본

`npm run build:embed-release`는 새 디렉터리에 다음을 조립한다.

| 경로                                   | 책임                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `index.html`, `_next/`, 이미지·폰트 등 | 현재 홈페이지와 일반 embed route                                                                        |
| `embed/releases/<version>/`            | 해당 prefix로 빌드한 불변 위젯·chunks·스타일·이미지·폰트와 manifest                                     |
| `embed/v1/loader.js`                   | 현재 활성 고정 버전을 불러오는 호환 채널                                                                |
| `embed/partner/`                       | 외부 전달용 코드·조회 전용 예시·README                                                                  |
| `embed-deployment.json`                | 전체 파일·각 release manifest의 SHA-256, 공개 URL, 활성 버전, source SHA·dirty·run ID, 직전 배포 digest |

manifest는 무결성·직전 공개본 대조에 사용하며 서명이나 인증 비밀이 아니다. 개인정보·운영 승인 기록은 넣지 않는다. `--production`은 미커밋 후보·설명용 URL·미커밋 고정 버전을 거절한다. 실패 폴더는 보존하고 새 경로에서 다시 만든다. 기존 archive를 덮어쓰거나 지우지 않는다.

홈페이지의 이전 `_next/static/` 파일도 누적 보존한다. 배포 전 HTML을 받은 탭이 이후 JS·CSS·폰트를 요청할 수 있기 때문이다. 같은 경로에 다른 바이트가 나타나면 덮어쓰지 않고 중단한다. 현재 홈페이지 HTML·일반 public 이미지 같은 변경 가능한 경로는 새 배포본을 따르며, 고정 위젯은 release 폴더 안에 별도 보존한 자원을 사용한다.

전체 배포와 각 고정 release에는 `submission.mode`와 접수 URL의 SHA-256인 `submission.endpointDigest`를 기록한다. 공개 검사는 홈페이지와 **보존된 모든 고정 버전**이 명시한 운영 endpoint와 일치하는지 확인한다. 접수 불가·테스트 설정·접수 설정 증거가 없는 이전 로컬 archive는 공개용으로 사용할 수 없다. 이 해시는 주소의 일치만 확인하며 서버 가용성·Google 배포 상태·인증을 입증하지 않는다.

## 로컬 조립과 검증

아래 PowerShell 예시는 외부 호출 없는 설명용 후보를 만든다. 디렉터리는 매번 새 경로를 지정한다. 테스트 endpoint는 실제 접수 주소가 아니며 브라우저 검사는 모든 요청을 가로챈다. 운영 설정으로 사용하지 않는다.

```powershell
$env:QUICK_ESTIMATE_LIVE_E2E = '0'
$env:NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/E2E-INTERCEPT-ONLY/exec'
$env:PAGES_BASE_PATH = '/release-check'
$env:EMBED_PUBLIC_BASE_URL = 'https://widget.example/release-check'
$env:NEXT_PUBLIC_SITE_ORIGIN = 'https://widget.example'
$env:NEXT_PUBLIC_SITE_BASE_PATH = '/release-check'
$env:EMBED_RELEASE = '1.0.0'
$env:EMBED_ARTIFACT_DIRECTORY = '.embed-artifacts/rehearsal-first'
Remove-Item Env:EMBED_PREVIOUS_ARTIFACT -ErrorAction SilentlyContinue
npm run build:embed-release
node scripts/build-embed-release.mjs --verify
npm run test:embed-release
```

다음 후보는 `EMBED_PREVIOUS_ARTIFACT`에 위 전체 폴더를 지정하고 새 버전·새 출력 경로로 만든다. 같은 ID를 다시 빌드하지 않는다. 브라우저 검사는 홈페이지·자동 채널·모든 pinned 버전·조회 전용 demo를 1440px/375px에서 확인한다. `EMBED_BROWSER_PREVIOUS_ARTIFACT`에 직전 배포 폴더를 지정하면 직전 홈페이지 HTML이 새 배포의 자원을 요청하는 경우도 확인한다. POST·누락 자원·브라우저 오류는 실패다.

`EMBED_PUBLIC_BASE_URL`의 prefix와 `PAGES_BASE_PATH`는 같아야 한다. custom domain 루트는 빈 basePath다. Next.js의 basePath와 공개 환경 변수는 빌드에 포함되므로 폴더 이동이나 실행 시 환경 변수 변경으로 대체하지 않는다. 별도 공식 문의 호스트에는 `NEXT_PUBLIC_SITE_ORIGIN`과 `NEXT_PUBLIC_SITE_BASE_PATH`를 함께 지정한다.

release 빌드는 `NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL`을 프로세스 환경 변수로 명시해야 접수를 활성화한다. 생략하면 빈 값으로 고정해 `.env.local` 등의 주소를 암묵적으로 사용하지 않는다. `--verify --production`과 공개본 대조 CLI에도 승인된 같은 주소를 명시해야 한다. 로컬 검증에서는 위 테스트 주소 또는 빈 값을 사용한다.

PowerShell에서는 옵션이 필요한 명령을 위 예시처럼 `node scripts/build-embed-release.mjs --verify`로 직접 실행한다. Node 22.15.0/npm 10.9.2의 `npm.ps1`을 경유한 `npm run … -- --rollback`은 이 환경에서 옵션이 누락되어 새 빌드를 시작했다. `npm.cmd run build:embed-release -- --rollback`도 인자를 보존하지만 직접 Node 실행을 기본 안내로 사용한다. Linux Actions의 npm 명령은 그대로 사용한다.

## 운영 전환 순서

1. **현재 상태와 복구본 확인:** 승인된 운영 작업에서 실제 서버 버전, 시트 24/16열·행·권한·트리거, 프런트를 확인한다. 기존 홈페이지 전체 archive와 Apps Script 버전을 보관한다. 과거 문서를 현재 운영 확인으로 대체하지 않는다.
2. **호환 서버 먼저 반영:** v1/v2와 확장 전후 schema를 다루는 Apps Script B·manifest를 반영한다. 실행 계정 scope·재인증과 기존 트리거도 확인한다. 홈페이지부터 v2로 공개하지 않는다.
3. **시트 확장과 readback:** 유지보수 구간에 `migrateQuickEstimateAttribution()`을 실행하고 29/18열, 기존 값·행 순서·업무 상태, codebook·보호·필터를 대조한다. `pending`이면 v2를 열지 않는다. 과거 출처를 추정하지 않는다.
4. **승인된 실제 연동 검증:** 비운영 환경에서 가짜 데이터로 먼저 확인한다. 필요한 운영 확인은 대상·건수·수신자·정리 정책을 승인받는다. 기존 요청, 홈페이지 v2, 서로 다른 사이트 v2, 동일 ID 재시도, 원본·상담·알림을 각각 확인한다.
5. **공개 조건 확인:** 개인정보 고지 문안·버전, 호스트 iframe/CSP, 브라우저·모바일, 제출 제한·알림 quota와 처리 용량을 확인한다. 10건/분·100건/일은 측정된 최대 용량이나 확정 제공 조건이 아니다.
6. **프런트와 모듈 공개:** 아래 workflow로 전체 artifact를 공개한다. 공개 확인 뒤 실제 URL의 전달 묶음을 제공한다. 사이트별 설치 확인은 제휴처가 정해질 때 추가한다.

Google 자원·권한·실제 제출과 메일은 로컬 자동 검사가 입증하지 않는다. 준비 변수는 위 확인 후 운영자가 설정하며 이 문서가 설정 승인이나 증적을 대신하지 않는다.

## 수동 GitHub Actions 연결안

`quality.yml`은 PR/main 검사만 수행한다. `embed-release.yml`은 `main`에서 수동 실행한다. 이 workflow의 저장소 반영과 수동 공개 실행은 별개다. Pages의 기존 GitHub Actions source, 운영 endpoint secret, `github-pages` 환경의 main 제한과 승인자, 저장소 변수 `QUICK_ESTIMATE_EMBED_SERVER_READY=attribution-v2-verified`를 확인해야 한다. 환경 승인자가 없으면 환경 이름만으로 사람의 승인을 보장하지 않는다.

| 입력                | 값                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------- |
| `release`           | 새 불변 버전. rollback에서는 사용하지 않음                                            |
| `previous_run_id`   | 현재 공개 manifest와 일치하는 전체 archive의 run ID. 최초 전환에만 `first`            |
| `rollback_run_id`   | 홈페이지·채널을 복구할 과거 archive run ID. 새 배포라면 빈칸                          |
| `operations_record` | 호환 서버·migration·고지·제한·실연동 확인의 내부 증적 참조. 비밀값·개인정보 입력 금지 |

직전 archive와 실제 공개 manifest digest를 비교한 뒤 빌드한다. 후보의 품질 게이트·무결성·브라우저 검사를 통과하면 `embed-pages-bundle`로 보관한다. 환경 승인 뒤 같은 archive의 접수 설정과 직전 공개 상태를 다시 확인한 후 Pages에 올린다. 승인 대기 중 endpoint secret이 바뀌어도 이미 빌드한 주소를 새 설정으로 오인해 공개하지 않는다. 공개 후 GET으로 동일 manifest를 확인한다. Google POST·migration·메일 발송은 workflow에 없다.

다른 배포가 반영됐거나 archive가 없거나 공개본이 응답하지 않으면 중단한다. 실패를 `first`로 우회하지 않는다. 배포는 직렬화하고 진행 중 작업을 새 실행으로 취소하지 않는다. 다른 수동 Pages 업로드·구형 workflow도 병행하지 않아야 이 순서를 보장한다.

### 최초 전환과 장기 보관

- `first`는 공개 manifest가 없고 이 모듈의 고정 버전을 제공한 적 없는 최초 전환에만 사용한다. HTTP 404 외의 통신 실패는 최초 상태로 보지 않는다. 실행 전 사람이 기존 설치·자원 이력을 확인한다.
- 기존 v1 홈페이지 archive는 새 manifest 형식 이전 자원이므로 자동 `--rollback`의 입력으로 사용할 수 없다. 최초 공개 전 기존 홈페이지 복구 절차를 별도로 준비하고 첫 성공한 v2 호환 배포본을 이후 rollback 기준으로 보관한다. 첫 버전에 이전 위젯 버전이 있는 것처럼 안내하지 않는다.
- `embed-pages-bundle`은 홈페이지와 지금까지 제공한 고정 버전 전체다. 제휴사에는 전체 archive 대신 `embed/partner/`만 전달한다.
- Actions artifact에는 보존 기한이 있다. workflow는 90일을 요청하지만 저장소 정책·삭제에도 영향을 받는다. 매 공개 때 전체 archive와 digest를 승인된 장기 보관 위치에 함께 보관한다. 장기 보관본도 로컬 `--verify`와 `--rollback`으로 검증·조립할 수 있다.
- Actions archive 만료·삭제 시 자동 공개는 중단한다. 장기 보관본을 복구하고 동일 검증을 거치는 별도 업로드 절차로 처리한다. 이전 버전을 버리고 새 배포를 시작하지 않는다. 보관 위치·담당자는 실제 출시 기록에 적으며 이번 작업에서 새 클라우드 저장소를 만들지 않는다.
- 버전 보존으로 정적 용량과 검증 시간이 증가하므로 공개 전 전체 크기·호스팅 제한을 확인한다. 지원 종료 합의 없이 자원을 자동 삭제하지 않는다.

기술 근거: [Pages 사용자 정의 workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [artifact 보존 기간](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts), [다른 run의 artifact 다운로드](https://github.com/actions/download-artifact). 원격 workflow 실행과 환경 보호 검증은 이번 로컬 검사 밖이다.

## 롤백

```powershell
$env:EMBED_PREVIOUS_ARTIFACT = '.embed-artifacts/rehearsal-second'
$env:EMBED_ROLLBACK_ARTIFACT = '.embed-artifacts/rehearsal-first'
$env:EMBED_ARTIFACT_DIRECTORY = '.embed-artifacts/rehearsal-rollback'
node scripts/build-embed-release.mjs --rollback
node scripts/build-embed-release.mjs --verify
$env:EMBED_BROWSER_PREVIOUS_ARTIFACT = $env:EMBED_PREVIOUS_ARTIFACT
npm run test:embed-release
```

홈페이지와 기본 loader는 첫 배포 상태로 돌아가고 두 번째 버전을 고정한 사이트의 파일은 계속 존재한다. 원본 archive는 수정하지 않는다. 이 명령은 로컬 후보만 만들며 운영 공개는 별도 단계다.

롤백은 복구 대상의 접수 설정도 그대로 복원한다. 현재 secret을 바꾼다고 과거 HTML의 접수 주소가 바뀌지 않는다. 기본안은 동일 Apps Script Web App URL의 호환 배포를 유지하며, endpoint가 다른 과거 archive·고정 버전이 있으면 공개 검증에서 중단한다. URL 교체가 필요한 경우 기존 주소의 지원과 제휴사 고정 버전 전환 절차를 별도로 설계한다. 검사를 우회하거나 이미 제공한 버전의 파일을 새 주소로 다시 빌드하지 않는다.

| 실패 시점                               | 처리                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 빌드·archive·무결성·운영 확인 실패      | 배포하지 않고 기존 공개본 유지. 후보·로그 보존                                                     |
| migration 일부 실패                     | v2를 열지 않고 같은 migration 재개. 새 열·상담 삭제 금지                                           |
| 공개 요청 실패·사후 GET 불일치          | 공개 manifest와 Pages 결과로 현재 상태 확인. 성공을 추정하거나 과거 archive를 단독 업로드하지 않음 |
| 홈페이지·기본 모듈 결함                 | 과거 배포본으로 rollback 후보를 만들되 현재 고정 버전 전부 보존                                    |
| 열린 탭·고정 버전 접수의 즉시 중단 필요 | 정적 rollback만으로 차단되지 않음. 승인된 서버 가용성 제어로 대응하고 홈페이지 영향도 확인         |

새 열·신규 상담과 호환 Apps Script B는 유지한다. 24열 전용 코드로 복귀하거나 과거 시트 snapshot을 전체 덮어쓰지 않는다.

## 운영 증적 양식

실제 값은 승인된 내부 기록에 남긴다. 로컬 검사만으로 완료 표시하지 않는다.

- [ ] 운영 서버·시트·프런트 현재 버전과 기존 홈페이지 archive
- [ ] 호환 서버 B·OAuth·기존 트리거
- [ ] 29/18열과 기존 데이터·권한·codebook·필터 readback
- [ ] v1/v2·출처·동일 ID 재시도·상담 투영·메일 실제 검증
- [ ] 고지·호스팅/CSP·모바일 실기기 확인
- [ ] 제한값·처리 시간·알림 여력과 근거
- [ ] source SHA·release·직전 digest·전체 archive·운영 증적 참조
- [ ] 최초 복구 절차 또는 과거 호환 archive의 rollback 검증
- [ ] 장기 archive 보관 위치·담당자·복구 방법
- [ ] 공개 digest 일치와 제휴사 전달 묶음
