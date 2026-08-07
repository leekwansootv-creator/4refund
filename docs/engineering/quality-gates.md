# 로컬 검사와 CI

## 단일 품질 게이트

로컬과 GitHub Actions는 모두 아래 명령을 사용한다.

```bash
npm run check
```

실행 순서는 다음과 같다.

| 순서 | 명령                         | 실패 조건                                               |
| ---- | ---------------------------- | ------------------------------------------------------- |
| 1    | `npm run format:check`       | Prettier 결과와 파일이 다름                             |
| 2    | `npm run lint`               | Next.js, React, TypeScript, 주석 lint 오류 또는 warning |
| 3    | `npm run typecheck`          | route type 생성 또는 TypeScript 오류                    |
| 4    | `npm run check:architecture` | 폴더, 이름, 의존성, 실행 환경 경계 위반                 |
| 5    | `npm run check:comments`     | 추적되지 않는 TODO/FIXME/XXX                            |
| 6    | `npm run check:apps-script`  | Apps Script 원본과 배포 artifact가 다름                 |
| 7    | `npm test`                   | 검사 도구와 UI 단위·컴포넌트 회귀 테스트 실패           |
| 8    | `npm run build`              | Next.js 프로덕션 빌드 실패                              |
| 9    | `npm run test:e2e:run`       | 브라우저 사용자 흐름 또는 자동 접근성 검사 실패         |

검사 순서를 건너뛰기 위해 `next.config.ts`에서 TypeScript 또는 ESLint 오류를 무시하지 않는다.

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
npm test
npm run test:unit
npm run test:e2e
npm run build
```

## 테스트 기준

테스트는 다음 도구와 책임으로 구분하고 모두 `npm run check`에 연결한다.

- `node:test`: 아키텍처·주석 검사와 Apps Script bundle 생성 도구의 회귀 테스트
- Vitest와 Testing Library: 순수 함수, 동기 컴포넌트, 상태 전이 회귀 테스트
- Playwright: 프로덕션 빌드에서 핵심 사용자 흐름과 브라우저 렌더링 검증
- `@axe-core/playwright`: 실제 페이지의 WCAG A/AA 자동 접근성 검사
- 버그 수정: 실패를 재현하는 회귀 테스트를 먼저 또는 같은 변경에서 추가

도구 선택 시 설치된 Next.js의 `node_modules/next/dist/docs/01-app/02-guides/testing/`을 먼저 확인한다.

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

프로덕션은 GitHub Pages에 Next.js 정적 export 결과물인 `out/`을 배포한다. 서버 런타임이 없으므로 Server Action, 동적 Route Handler, cookie·header 기반 응답, ISR, 기본 `next/image` loader처럼 요청 시점의 Next.js 서버가 필요한 기능은 사용할 수 없다. 이런 기능이 필요해지면 구현 전에 호스팅 대상을 다시 결정한다.

- pull request에서는 `Quality / verify`까지만 실행하고 preview 환경은 만들지 않는다.
- `main` push의 `Quality / verify`가 성공해야 같은 commit SHA를 다시 정적 export하고 `github-pages` 환경에 배포한다.
- Pages의 기본 URL과 custom domain 차이는 `actions/configure-pages`가 제공하는 `PAGES_BASE_PATH`로 빌드에 주입한다.
- 배포 job은 저장소에 URL을 남기지 않도록 `QUICK_ESTIMATE_APPS_SCRIPT_URL` secret을 `NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL`로 빌드 시 주입한다. 이 값은 브라우저에 포함되는 공개 endpoint이며 인증 secret으로 사용하지 않는다.
- 배포 job은 endpoint가 없거나 Apps Script Web App URL 형식이 아니면 정적 export 전에 실패한다. DB migration은 없다.
- rollback은 문제 commit을 `main`에서 revert하여 이전 정적 결과물을 다시 배포하는 방식으로 수행한다.
- 배포 후 GitHub Actions의 `deploy-pages` 결과와 배포 URL의 HTTP 응답, 주요 이미지·링크를 확인한다.

저장소 관리자는 Pages의 Source를 `GitHub Actions`로 설정하고 `github-pages` 환경은 `main`만 배포할 수 있도록 보호한다. custom domain과 HTTPS는 Pages 설정 및 DNS에서 별도로 활성화한다.

## 의존성 보안

`npm audit` 결과는 정기적으로 확인하되 자동 `npm audit fix --force`는 사용하지 않는다. 수정 가능한 직접 의존성인지, 빌드 도구의 전이 의존성인지, 런타임 도달 가능성이 있는지 확인한 뒤 lockfile과 전체 품질 게이트를 함께 검증한다.
