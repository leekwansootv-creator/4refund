# 로컬 검사와 CI

## 단일 품질 게이트

로컬과 GitHub Actions는 모두 아래 명령을 사용한다.

```bash
npm run check
```

실행 순서는 다음과 같다.

| 순서 | 명령                           | 실패 조건                                               |
| ---- | ------------------------------ | ------------------------------------------------------- |
| 1    | `npm run format:check`         | Prettier 결과와 파일이 다름                             |
| 2    | `npm run lint`                 | Next.js, React, TypeScript, 주석 lint 오류 또는 warning |
| 3    | `npm run typecheck`            | route type 생성 또는 TypeScript 오류                    |
| 4    | `npm run check:architecture`   | 폴더, 이름, 의존성, 실행 환경 경계 위반                 |
| 5    | `npm run check:comments`       | 추적되지 않는 TODO/FIXME/XXX                            |
| 6    | `npm run check:apps-script`    | Apps Script 원본과 배포 artifact가 다름                 |
| 7    | `npm run check:news-extractor` | 독립 Python 수집기의 lint·포맷·보안/HTTP 테스트 실패    |
| 8    | `npm test`                     | 검사 도구와 UI 단위·컴포넌트 회귀 테스트 실패           |
| 9    | `npm run build:e2e`            | Next.js 프로덕션 빌드 실패                              |
| 10   | `npm run test:e2e:run`         | 브라우저 사용자 흐름 또는 자동 접근성 검사 실패         |

검사 순서를 건너뛰기 위해 `next.config.ts`에서 TypeScript 또는 ESLint 오류를 무시하지 않는다.

뉴스 수집기는 Python 3.13.16과 uv 0.13.4를 사용한다. 로컬 PATH에 uv를 준비하며
`check:news-extractor`는 `services/news-extractor/uv.lock`을 `--locked`로 동기화하고 Ruff·pytest를
실행한다. Python 테스트도 전체 `npm run check`에 포함하며 누락된 runtime을 조용히 건너뛰지 않는다.
GitHub Quality와 수동 Embed release의 검증 단계 모두 같은 uv 버전을 설치한다.
이번 작업에서는 workflow 파일만 수정했고 원격 workflow·배포는 실행하지 않았다.

일반 뉴스 E2E는 `NEWS-E2E-INTERCEPT-ONLY`의 모의 피드를 사용한다. 공용 fixture가 GET을 가로채며
기존 전체 요청 handler는 `route.fallback()`으로 넘겨 모의 피드를 건너뛰지 않는다.
실제 기사·Google 게시·CORS 검증과 모의 응답의 카드 상태 검증을 구분한다.

일반 검사 빌드는 `scripts/build-e2e.mjs`가 `NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL`을 테스트 전용 식별자의 `https://script.google.com/macros/s/E2E-INTERCEPT-ONLY/exec`로 주입한다. 따라서 로컬 운영 설정 유무와 관계없이 일반 E2E가 모든 POST를 가로채 조회/신청 경계를 검증한다. `QUICK_ESTIMATE_LIVE_E2E=1`로 명시한 별도 실제 저장 검사만 승인된 환경 설정을 사용한다. `npm run build`와 운영 배포의 endpoint 필수·형식 검사는 유지한다.

## 개발 명령

```bash
npm run dev
npm run format
npm run lint
npm run typecheck
npm run check:architecture
npm run check:comments
npm run build:apps-script
npm run check:apps-script
npm run check:news-extractor
npm test
npm run test:unit
npm run test:e2e
npm run build
npm run build:embed-release
npm run test:embed-release
```

## 테스트 기준

테스트는 다음 도구와 책임으로 구분하고 모두 `npm run check`에 연결한다.

- `node:test`: 아키텍처·주석 검사와 Apps Script bundle 생성 도구의 회귀 테스트
- Vitest와 Testing Library: 순수 함수, 동기 컴포넌트, 상태 전이 회귀 테스트
- Playwright: 프로덕션 빌드에서 핵심 사용자 흐름과 브라우저 렌더링 검증
- `@axe-core/playwright`: 실제 페이지의 WCAG A/AA 자동 접근성 검사
- 버그 수정: 실패를 재현하는 회귀 테스트를 먼저 또는 같은 변경에서 추가

도구 선택 시 설치된 Next.js의 `node_modules/next/dist/docs/01-app/02-guides/testing/`을 먼저 확인한다.

외부 삽입은 `e2e/quick-estimate-embed.spec.ts`에서 로컬 export 자원을 모의 HTTPS origin으로 제공해 검증한다. 제휴 origin과 위젯 origin은 분리하며 모든 POST는 모의 응답·차단으로 처리한다. `npm test`에는 출처 요청·시트 migration·제한 설정·release 무결성과 rollback 검사가 포함된다. `npm run build:embed-release`는 별도 로컬 artifact만 만들며 공개 배포를 수행하지 않는다. 설치·전환 절차는 [외부 삽입 가이드](quick-estimate-embed-installation.md)를 따른다.

## GitHub Actions

`.github/workflows/quality.yml`은 pull request와 `main` push에서 실행한다.

- `.nvmrc`와 같은 Node.js 사용
- `npm ci`로 lockfile과 동일한 의존성 설치
- Chromium과 시스템 의존성을 Playwright CLI로 설치
- npm과 `.next/cache` 재사용
- 검증 job에는 최소 `contents: read` 권한만 부여
- 같은 ref의 이전 실행을 취소
- `npm run check`를 유일한 검증 명령으로 사용

저장소 설정에서 `Quality / verify`를 `main`의 필수 status check로 지정해야 merge 차단이 완성된다. 이 설정은 GitHub 저장소 관리자 권한으로 별도 적용한다.

## 배포

프로덕션은 GitHub Pages의 정적 호스팅을 유지한다. 외부 모듈을 공개할 때는 일반 `out/` 대신 홈페이지와 모든 고정 release를 조립한 배포본을 사용한다. 서버 런타임이 없으므로 Server Action, 동적 Route Handler, cookie·header 기반 응답, ISR, 기본 `next/image` loader처럼 요청 시점의 Next.js 서버가 필요한 기능은 사용할 수 없다. 이런 기능이 필요해지면 구현 전에 호스팅 대상을 다시 결정한다.

- pull request에서는 `Quality / verify`까지만 실행하고 preview 환경은 만들지 않는다.
- `main` push와 PR은 `Quality / verify`만 수행한다. 공개는 별도 `Embed release`의 `workflow_dispatch`로만 시작한다. workflow를 저장소에 반영하거나 PR을 병합하는 것만으로 공개 배포를 시작하지 않는다.
- 수동 workflow는 `main`의 선택된 SHA에서 `npm run check`를 실행한다. 운영 서버 v2 확인값·내부 운영 증적 참조, 직전 공개본과 archive의 일치를 요구한다. Google 준비를 자동으로 추정하거나 실제 신청으로 탐색하지 않는다.
- Pages의 기본 URL과 custom domain 차이는 `actions/configure-pages`가 제공하는 `PAGES_BASE_PATH`로 빌드에 주입한다.
- 배포 job은 저장소에 URL을 남기지 않도록 `QUICK_ESTIMATE_APPS_SCRIPT_URL` secret을 `NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL`로 빌드 시 주입한다. 이 값은 브라우저에 포함되는 공개 endpoint이며 인증 secret으로 사용하지 않는다.
- 배포 job은 endpoint가 없거나 Apps Script Web App URL 형식이 아니거나 일반 E2E endpoint이면 실패한다. 시트 확장은 별도 승인된 Apps Script 운영 단계이며 workflow에서 실행하지 않는다.
- 전체 artifact 검증과 `npm run test:embed-release`를 통과한 파일을 archive한 뒤 `github-pages` 환경에서 같은 파일을 공개한다. 환경 승인 대기 뒤에도 직전 공개본의 digest를 재확인한다. 배포 동시 실행은 직렬화하며 진행 중인 배포를 새 요청으로 취소하지 않는다.
- rollback은 과거 홈페이지와 기본 채널을 새 artifact로 복구하면서 현재까지의 고정 release와 홈페이지 `_next/static/` 자원을 모두 보존한다. 단순 revert·과거 archive 단독 업로드로 새 버전 경로를 삭제하지 않는다.
- 홈페이지와 모든 보존 release의 접수 설정 해시를 운영 endpoint secret과 대조한다. 접수 비활성·테스트 주소·설정 증거가 없는 로컬 archive는 공개하지 않는다. 승인 대기 뒤에도 같은 검사를 수행하며 과거 archive의 주소를 현재 secret 값으로 추정하지 않는다.
- 두 번째 공개부터는 직전 홈페이지 HTML이 새 배포의 자원으로 조회되는지도 브라우저에서 확인한다. rollback에도 동일하게 적용한다.
- 배포 후 `Embed release / deploy`의 Pages 결과와 공개 manifest, 주요 이미지·링크를 확인한다.

저장소 관리자는 Pages의 Source를 `GitHub Actions`로 설정하고 `github-pages` 환경은 `main`만 배포할 수 있도록 보호한다. custom domain과 HTTPS는 Pages 설정 및 DNS에서 별도로 활성화한다.

전체 archive의 보존 기한과 최초 전환, 실패·롤백 절차는 [출시·복구 절차](../operations/quick-estimate-embed-release.md)를 따른다. 수동 입력과 저장소 변수는 운영 증적을 대신하지 않으며 실제 환경 보호 규칙의 설정 여부도 별도로 확인한다.

## 의존성 보안

`npm audit` 결과는 정기적으로 확인하되 자동 `npm audit fix --force`는 사용하지 않는다. 수정 가능한 직접 의존성인지, 빌드 도구의 전이 의존성인지, 런타임 도달 가능성이 있는지 확인한 뒤 lockfile과 전체 품질 게이트를 함께 검증한다.

## 코드·보안 검토

2026-10-23 사용자 승인에 따라 이 저장소는 원격 Codex Code Review·Security Review 연결의 예외로 두고 로컬 검토를 병합 근거로 사용한다. GitHub 앱 연결과 원격 리뷰 완료를 필수 병합 조건으로 요구하지 않는다. 이 예외는 자동 테스트, 실제 head 확인, 운영 변경 승인 기준을 완화하지 않는다.

- 변경 diff와 관련 호출 경로를 직접 검토한다. 외부 입력·메시지·개인정보·저장·재시도·배포 자원의 신뢰 경계를 포함한다.
- 재현된 버그는 회귀 테스트와 함께 수정하고 `npm run check`를 통과시킨다. 실제 Google 접수·알림 검사는 별도 승인 전에는 실행하지 않는다.
- 의존성 경고는 신규 유입 여부와 실제 실행 환경을 구분해 기록한다. 검토 범위 밖의 기존 경고도 숨기거나 보안 검사 통과로 표시하지 않는다.
- PR에 검토한 commit, 수정 사항, 검증 결과, 남은 제한과 원격 리뷰 미실행 사유를 남긴다. 로컬 검토를 원격 Code Review·Security 완료로 표시하지 않는다.
- 병합 직전에 원격 head와 필수 검사를 다시 확인하고 예상 head를 지정해 병합한다. 병합 응답 뒤 실제 merged 상태와 원격 main 반영을 읽어 확인한다.
