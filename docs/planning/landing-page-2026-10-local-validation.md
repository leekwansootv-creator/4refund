# 랜딩 개편 로컬 구현·검증 기록 — 2026-10-27

이 문서는 PR 게시 전 로컬 구현·검증 시점의 기록이다. 이후 사용자가 요청한 PR 출하와
원격 검사 상태는 PR 본문·검수 기록에서 별도로 확인한다.

## 범위와 기준

승인된 랜딩 콘텐츠/시각 개편과 뉴스 공개 카드 표시 구조를 구현했다. 뉴스 관리 서버,
인증/저장/URL 추출/게시/실제 공개 데이터 연결은 아직 구현하지 않았다. 기존 CMS 확장에
관한 사용자 선택은 읽기 전용 검토이며, 구체 확장안의 구현 결정은 답변 대기다.

- 원본: `C:\Project\4refund`, `codex/quick-estimate-security-readiness`,
  `3c5e0f97c04c09c88f60288e94f25c1e074aa217`. 시작/종료 확인에서 변경 없음.
- 구현: `C:\Users\user\.codex\worktrees\landing-news-refresh\4refund`,
  `codex/landing-news-refresh`, 기준/HEAD `7c73b5f0d8b6dbafd4fcafb31f0386ddab0be203`.
- 원격: `https://github.com/leekwansootv-creator/4refund.git`. fetch한 최신 origin/main에
  PR #52 자료가 포함됨을 확인했다. 과거 분석 기준 ac39eda로 되돌리지 않았다.
- Node 22.15.0 / npm 10.9.2 / Next.js 16.4.2 / React 19.2.4.
  설치된 Next 문서의 정적 export, 서버/클라이언트 경계, 이미지, 테스트 가이드를 확인했다.
- 커밋·stage·push·PR·병합·배포 없음. 기존 worktree와 산출물 삭제 없음.
- CMS는 `C:\Project\4refund-cms`의 `feat/cms-tutorial-phase1`,
  `7cf1a8ac1d8e3a664cf790c6c7db9fced9eddb87`을 읽기 전용으로 확인했다.
  미커밋 튜토리얼 작업·운영 DB·계정 설정을 수정하지 않았다.

## 구현 결과

- 구성원 6명의 실제 사진, 센터장/부센터장 공통 소개 행, 두 인물의 사진/경력.
  후속 지시에 따라 실루엣을 교체하고 박진석은 하단의 큰 원본을 원형으로 크롭했다.
- 전문가 도입 64px 제목, 설명 카드, 기술 이미지 크롭과 특허 표시.
- 후속 지시에 따라 전문가 도입 이미지에도 기존 좌우 진입과 위아래 반복 모션을 연결했다.
  기존 28.020507초 주기와 재진입 재생을 재사용하며 reduced motion에서는 정지한다.
- 승인된 RPA·AI 행과 보안 설명. 사용자의 콘텐츠 승인은 별도 사실 검증을 의미하지 않는다.
- Footer 최소 높이 229px, 포리펀 저작권. 기존 전화·팩스·이메일 유지.
- `news-insights` 공개 표시 컴포넌트: 미연결/로딩/조회 실패/게시 목록,
  0건 숨김, 실제 수량 최대 3개, 전체 제목의 접근 가능한 링크 이름, 이미지 대체와 재시도.
- 홈페이지는 `unconfigured`이므로 실제 또는 예시 뉴스 카드를 노출하지 않는다.
  테스트용 기사는 단위 테스트와 저장소 밖 브라우저 검증 도구에만 있다.
- 기존 hero/사례/헤더/혜택/절차/문의와 선조회→상세 견적→최종 신청 계약 보존.
  `src/app`, 견적 계산/전송 코드와 외부 임베드 코드는 수정하지 않았다.

## 보존 디자인과 차이

- 모바일 신규 원본은 없다. 기존 반응형 기준을 확장해 구성원은 작은 화면 2열,
  인물 소개는 사진 다음 경력, 전문가 도입은 기존 1280px 이하 세로 배치를 사용한다.
  뉴스 1/2/3열은 검토안이며 확정 회신 대기다.
- 인물 소개는 긴 경력 때문에 고정 높이로 잘리지 않도록 유동 높이로 표시한다.
  부센터장 경력은 각 항목 한 줄로 표시한다. 한 줄 대응 중 잘못 줄였던 데스크톱 여백은
  후속 대조에서 좌우 155px, 경력 열 폭 356px·간격 32px로 복원했다.
  사진의 투명한 왼쪽 공간과 텍스트 영역을 겹쳐 배치하므로 인물과 경력은 겹치지 않는다.
  1280px 미만에서는 기존 반응형 배치를 사용한다.
- 강점 본문은 원본 #878787 대신 #6b6b6b, 뉴스 안내는 #56627a를 사용한다.
  375/768px에서 발견한 대비 부족을 수정하고 회귀 검사에 포함했다.
- 모바일 제목은 단어를 유지해 줄바꿈한다. 브라우저 글꼴 렌더링의 줄바꿈은
  Figma 캡처와 완전히 동일하다고 보장하지 않는다.
- 원본 오탈자 “최상의 결과와 위해”로 되돌리지 않고 기존 정상 문장을 유지했다.
- 뉴스의 카드 수/실패/재시도는 시안에 없던 검토안이다. 실제 기사 대신 예시를 게시하지 않았다.
- 원본 연락처 우선 팝업과 용도 미정 봉투 팝업은 추가하지 않았다.
- 보존 자료 폴더와 .gitignore는 변경하지 않았다. 필요한 에셋 9개만 의미 있는 이름으로 복사했다.
  구현에 추가한 PNG 4개는 PNG 시그니처를 확인했다. JPEG인 뉴스 예시는 복사하지 않았다.

## 실행 결과

`$env:QUICK_ESTIMATE_LIVE_E2E = '0'`을 적용했다. 일반 E2E의 전송은 모의 응답/차단으로
검증했으며 Google Apps Script·Sheets 운영 데이터 접근, 실제 신청과 알림 발송은 없었다.

| 검사                                                           | 이번 실행 결과                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| manifest                                                       | 85개 파일 누락/크기/해시 불일치 없음                          |
| npm ci --no-audit --no-fund                                    | 성공, lockfile 변경 없음                                      |
| npm run check                                                  | 최종 종료 코드 0                                              |
| format/lint/typecheck/architecture/comments/Apps Script parity | 통과                                                          |
| node:test                                                      | 24개 통과                                                     |
| Vitest                                                         | 36개 파일, 287개 테스트 통과                                  |
| 정적 export 빌드                                               | 성공                                                          |
| Playwright                                                     | 40개 통과, 실제 저장 5개 skipped                              |
| git diff --check                                               | 통과                                                          |
| 추가 랜딩 브라우저 검사                                        | 네 폭에서 가로 넘침/이미지 실패/런타임 오류 없음              |
| 추가 랜딩 axe                                                  | 375/768/1280/1920px WCAG A/AA 위반 0                          |
| 뉴스 브라우저 검사                                             | 네 폭 × 0/1/2/3/5건/로딩/오류 = 28개 조합 통과, axe 위반 0    |
| 뉴스 키보드                                                    | 375/1920px에서 Tab으로 카드·재시도 접근, Enter로 재시도       |
| 확대/포커스                                                    | CSS zoom 200%에서 가로 넘침 없음, 모달 닫기 후 진입 버튼 복귀 |

초기 실행에서 포맷 오류를 수정했고, 브라우저에서 발견한 Next Image fill/width 충돌도
크롭을 별도 부모 표시 창으로 옮겨 해결했다. 첫 전체 검사 통과 후 폭별 추가 검사에서
회색 대비 부족을 발견하여 수정했다. 최종 전체 검사는 이 수정과 폭별 axe 회귀 검사,
실제 인물 사진, 경력 한 줄 배치, 전문가 도입 모션 회귀 검사까지 포함한다.
스크린리더 실기기 검수, 모든 브라우저/OS 및 실제 운영 검증을 수행했다는 의미는 아니다.
200%는 CSS zoom 기반 브라우저 검증이며 브라우저 메뉴 확대와 구분한다.

## 화면과 증거

로컬 홈페이지를 실제 브라우저 `http://127.0.0.1:3111`에서 열어 DOM과 화면을 확인했다.
동일 주소는 최종 검사에서 생성한 `out/`을 제공하는 정적 빌드 미리보기다.
테스트 endpoint로 빌드했으며 운영 접수 검증용이 아니다.

### 사진·경력·모션 후속 검증

- 375/768/1280/1920px에서 6명 모두 실제 사진을 표시하고 가로 넘침이 없음을 확인했다.
  박진석 원형 사진은 큰 소개 사진과 같은 원본을 CSS로 크롭한다.
- 같은 네 폭에서 부센터장 경력 7개를 각각 한 줄로 표시하는 것을 DOM과 캡처로 확인했다.
- 후속 여백 수정 뒤 같은 네 폭을 다시 확인했다. 1280/1920px에서 이름 왼쪽과 사진 영역
  오른쪽 여백은 모두 155px, 경력 두 열 시작점 간 거리는 388px(356 + 32)이었다.
  경력 7개 한 줄 표시와 가로 넘침 없음도 유지했다. 외부 ngrok 화면에서 155px 반영을 확인했다.
  Browser 플러그인이 없어 저장소 Playwright로 메뉴→센터 소개 이동과 렌더링을 검사했다.
- 실제 시간으로 28.02초 주기가 한 번 완료되는 것과 화면 재진입 시 재생을 확인했다.
  reduced motion에서는 `animation: none`, `transform: none`이었다.
- 기존 ngrok 실행 파일과 설정을 재사용해 사용자 요청의 외부 미리보기를 열었다.
  개발 서버에서 외부 브라우저의 JavaScript 초기화가 완료되지 않는 현상이 있어
  같은 3111 포트를 최종 정적 빌드 서버로 전환했다. 소스 설정이나 호스팅은 변경하지 않았다.
- 당시 외부 주소는 `https://c8b2-211-177-16-159.ngrok-free.app`이다.
  외부 Chromium에서 이미지 디코드 완료(1312×1199), 모션의 실제 위치 변화,
  reduced motion 정지, 런타임/요청 오류 없음을 확인했다. GET만 허용해 검사했다.
  주소의 가용성은 로컬 미리보기와 ngrok 프로세스 실행에 의존한다.

보존 `index.html` 직접 열기는 브라우저의 file 프로토콜 접근 제한으로 완료하지 못했다.
HTML 원문과 연결된 보존 캡처를 파일로 확인하고 실제 랜딩 캡처와 비교했다.
Figma 재연결/재인증은 요청하지 않았다.

이번 컴퓨터의 로컬 증거 폴더(저장소 밖):

```text
C:\Users\user\.codex\visualizations\2026\10\27\01a17ba8-0bd2-7980-988a-b5c808f149b7
```

- `npm-check-deputy-spacing.log`: 디자인 여백 복원 후 최종 필수 검사 로그(종료 0, 40 passed/5 skipped).
- `npm-check-portraits-motion.log`: 사진·경력·모션 수정 후 검사 로그(40 passed/5 skipped).
- `npm-check-final.log`: 위 후속 수정 이전의 전체 검사 로그(39 passed/5 skipped).
- `portraits-roster-{375,768,1280,1920}.png`: 실제 구성원 사진과 원형 크롭.
- `portraits-deputy-{375,768,1280,1920}.png`: 경력 한 줄 배치.
- `portraits-layout-results.json`: 네 폭의 경력 줄 수와 가로 넘침 검사.
- `expert-motion-results.json`, `expert-motion-preview.webm`: 실제 한 주기/재진입/reduced motion 증거.
- `ngrok-preview-results.json`, `ngrok-motion-results.json`, `ngrok-expert-motion.png`: 외부 정적 미리보기 확인.
- `deputy-spacing-{375,768,1280,1920}.png`, `deputy-spacing-ngrok.png`: 디자인 여백 복원 뒤 화면.
- `deputy-spacing-results.json`: 여백·한 줄 표시·메뉴 이동·가로 넘침·런타임 오류 재확인.
- `landing-accessibility-results.json`: 네 폭의 axe, 메뉴 이동 시 제목 노출, CSS 200%, 포커스 복귀.
- `landing-visual-results.json`: 네 폭의 overflow/이미지/런타임 검사.
- `news-visual-results.json`: 28개 조합과 CSS 200% 검사.
- `news-keyboard-results.json`: Tab/Enter 확인.
- `center-review-{375,768,1280,1920}.png`: 두 인물 소개.
- `expert-review-{375,768,1280,1920}.png`: 제목/설명 카드/기술 이미지.
- `rpa-review-*.png`, `security-review-*.png`: 최종 대비 수정 후 강점 행.
- `news-{0,1,2,3,5,loading,error}-{375,768,1280,1920}.png`: 개발 검증용 표시가 있는 카드 상태.
- `estimate-zoom-200.png`, `news-zoom-200.png`: 확대 상태.
- `verify-landing-accessibility.cjs`, `verify-news.cjs`, `verify-news-keyboard.cjs`: 추가 검사 재현 도구.

뉴스 도구는 실제 제품 컴포넌트를 esbuild로 묶고 Playwright의 로컬 응답 가로채기로
테스트 화면을 제공한다. 운영 페이지/라우트/공개 데이터를 추가하지 않는다.
이 경로의 증거는 다른 컴퓨터에 자동 복제되지 않는다.

## 미구현·미결정

- 기존 CMS 구체 확장안의 구현 여부: 기존 로그인/PostgreSQL, 명시적 뉴스 관리 권한,
  별도 공개 이미지와 게시 데이터, Pages 유지, 캐시 최대 60초 제안.
- 실제 기사 URL, 등록 담당자, 게시 정렬/재게시 시각과 공개 반영 정책.
- 신규 모바일 배치 및 뉴스 0건 숨김/최대 3건/새 창/실패 재시도 정책의 최종 확인.
- 인증/초안·게시·숨김/수동 값 보존/중복·충돌/원문 변경/메타데이터 추출은 미구현.
- 서버의 공개 데이터 투영과 SSRF/DNS/redirect/time/size/image 검증은 설계 제안만 있고
  운영되거나 테스트된 기능이 아니다. 공개 endpoint 연결과 실제 게시 반영도 미검증.
- 상세 제안과 사용자 승인 기록은 [변경 기획](landing-page-2026-10-change-plan.md)의
  “2026-10-27 로컬 구현과 CMS 확장 검토” 절을 따른다.

## 변경 파일

### 랜딩과 테스트

```text
src/features/landing-page/components/center-introduction-section.tsx
src/features/landing-page/components/center-leader-profile.tsx (신규)
src/features/landing-page/components/center-leader-profile.module.css (신규)
src/features/landing-page/components/center-leader-profile.test.tsx (신규)
src/features/landing-page/components/expert-strengths-section.tsx
src/features/landing-page/components/landing-expert-strengths.module.css
src/features/landing-page/components/landing-responsive.module.css
src/features/landing-page/components/landing-reveal-controller.tsx
src/features/landing-page/components/landing-page.tsx
src/features/landing-page/components/site-footer.tsx
src/features/landing-page/constants/landing-assets.ts
src/features/landing-page/constants/landing-content.ts
src/features/news-insights/index.ts (신규)
src/features/news-insights/types/news-insights.ts (신규)
src/features/news-insights/components/news-insights-section.tsx (신규)
src/features/news-insights/components/news-card-image.tsx (신규)
src/features/news-insights/components/news-insights.module.css (신규)
src/features/news-insights/components/news-insights-section.test.tsx (신규)
e2e/landing-page.spec.ts
e2e/landing-refresh.spec.ts (신규)
docs/planning/landing-page-2026-10-change-plan.md
docs/planning/landing-page-2026-10-local-validation.md (신규)
```

### 구현용 에셋 (모두 신규)

```text
public/assets/landing/images/center-deputy-park-jin-seok.png
public/assets/landing/images/center-member-silhouette.svg
public/assets/landing/images/expert-technology.png
public/assets/landing/images/expert-rpa-ai.png
public/assets/landing/icons/expert-consultation.svg
public/assets/landing/icons/expert-automation.svg
public/assets/landing/icons/expert-security.svg
public/assets/landing/icons/patent-award.svg
public/assets/news/article-fallback.png
```
