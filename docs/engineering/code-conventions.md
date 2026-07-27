# 코드 컨벤션

이 문서는 코드의 모양뿐 아니라 컴포넌트 책임, 공통화, 상태와 데이터 흐름, 오류 처리, 성능, 주석을 결정한다. 폴더의 물리적 위치와 의존성 방향은 `architecture.md`를 함께 따른다.

## 기본 원칙

- 읽기 쉬운 명시적 코드를 짧은 영리한 코드보다 우선한다.
- 하나의 모듈은 하나의 변경 이유와 명확한 소유 feature를 갖는다.
- 중복 제거보다 잘못된 추상화를 피하는 것을 우선한다.
- 프레임워크 기본 동작을 우선하고 자체 추상화는 반복되는 필요가 확인된 뒤 추가한다.
- 클라이언트 상태와 JavaScript를 최소화하고 서버에서 해결할 수 있는 일은 서버에 둔다.
- 사용자에게 보이는 성공, 로딩, 빈 상태, 오류, 비활성 상태를 함께 설계한다.

## TypeScript

- 새 애플리케이션 코드는 `.ts` 또는 `.tsx`로 작성한다.
- `strict`와 `tsconfig.json`의 추가 안전성 옵션을 유지한다.
- `any`, 무근거 type assertion, `@ts-ignore`로 오류를 숨기지 않는다.
- 외부 입력은 신뢰하지 않고 schema 또는 명시적 guard로 검증한다.
- 타입은 사용하는 곳 가까이에 두고, feature 밖에서 사용하는 계약만 `types` 또는 공개 진입점으로 이동한다.
- 함수 반환 타입은 공개 계약, 재귀 함수, 복잡한 union처럼 경계를 고정할 때 명시한다.
- 상태별 shape가 다르면 optional 속성 묶음보다 discriminated union을 사용한다.
- `null`과 `undefined`의 의미를 구분하고 “값 없음” 표현을 한 계약 안에서 섞지 않는다.
- 공유 계약도 구현에서 안전하게 추론할 수 있으면 중복 선언하지 않는다.
- 타입 전용 의존성은 `import type`을 사용한다.
- `next-env.d.ts`는 Next.js가 생성하므로 수정하거나 Git에 추적하지 않는다.

## 컴포넌트 설계

### 책임과 분리

- 컴포넌트는 하나의 UI 책임 또는 하나의 사용자 상호작용을 표현한다.
- route의 `page.tsx`와 `layout.tsx`는 데이터 준비와 feature 조합만 담당한다.
- 데이터 조회, mutation, 복잡한 계산을 표현 JSX 안에 섞지 않는다.
- 컴포넌트 안에서 다른 컴포넌트를 선언하지 않는다. 렌더마다 새 타입이 되어 상태와 DOM이 다시 만들어질 수 있다.
- 큰 파일이라는 이유만으로 나누지 않는다. 독립적인 이름, 책임, 상태, 재사용 가능성이 있을 때 분리한다.
- 컴포넌트가 조건문으로 여러 제품 기능을 동시에 처리하기 시작하면 공통화가 아니라 feature 분리가 필요한지 먼저 확인한다.

### 공통 컴포넌트 판단

같은 모양이 두 번 등장했다는 사실만으로 `shared`로 이동하지 않는다. 아래 조건을 모두 만족할 때 공통화를 우선 검토한다.

1. 둘 이상의 실제 사용처가 있거나 곧 추가될 사용처가 명확하다.
2. 사용처들이 같은 의미, 동작, 접근성, 시각적 상태를 요구한다.
3. 함께 변경될 가능성이 높고 변경 이유가 같다.
4. 특정 feature의 타입, 문구, 권한, 비즈니스 분기를 몰라도 API를 설명할 수 있다.
5. boolean prop을 계속 추가하지 않고 composition이나 명확한 variant로 차이를 표현할 수 있다.

배치 기준은 다음과 같다.

| 컴포넌트 성격                                              | 위치                                                |
| ---------------------------------------------------------- | --------------------------------------------------- |
| 한 화면에서만 쓰는 작은 조각                               | 해당 feature의 `components`                         |
| 한 feature의 여러 화면에서 쓰는 기능 UI                    | 해당 feature의 `components`                         |
| 다른 feature도 사용하지만 환불 등 비즈니스 의미를 소유함   | 소유 feature가 구현하고 루트 `index.ts`로 공개      |
| 버튼, 입력, 모달처럼 비즈니스 의미가 없는 UI primitive     | `shared/components/ui`                              |
| 페이지 shell, 공용 header처럼 비즈니스 의미가 없는 조합 UI | `shared/components/layout` 또는 `shared/components` |

공통화하지 말아야 하는 신호는 다음과 같다.

- 이름이 `Common`, `Base`, `General`처럼 책임을 설명하지 못한다.
- `isRefund`, `isAdmin`, `isCompact`, `showX` 같은 boolean prop이 계속 늘어난다.
- 호출하는 쪽보다 공통 컴포넌트 내부의 조건문이 더 복잡하다.
- 스타일만 비슷하고 데이터 의미, 행동, 접근성 요구가 다르다.
- 한 사용처를 수정할 때 다른 사용처가 자주 깨진다.

이 경우에는 중복을 잠시 유지하거나 낮은 수준의 primitive만 공유하고 feature 컴포넌트는 분리한다.

### Props와 합성

- props는 컴포넌트가 실제로 사용하는 최소 데이터만 받는다. DB row나 거대한 API 응답을 그대로 전달하지 않는다.
- callback은 `onSubmit`, `onOpenChange`처럼 발생한 사건을 이름으로 표현한다.
- 단순한 시각적 차이는 제한된 `variant`로 표현하고, 서로 다른 구조는 `children`이나 명시적 slot으로 합성한다.
- boolean prop 여러 개로 가능한 조합을 폭발시키지 않는다. 유효한 조합이 정해져 있으면 discriminated union을 사용한다.
- `className` 확장은 공용 primitive에서만 신중히 허용한다. feature 컴포넌트의 핵심 스타일 계약을 외부가 임의로 깨지 않게 한다.
- key에 배열 index를 사용하지 않는다. 정렬과 삽입 후에도 항목을 식별하는 안정적인 값을 사용한다.

## 상태와 데이터 흐름

- 상태는 사용하는 가장 가까운 컴포넌트에 둔다.
- 여러 형제가 필요로 할 때만 가장 가까운 공통 부모로 올린다.
- 현재 props나 state로 계산할 수 있는 값은 별도 state나 effect에 저장하지 않고 렌더 중 계산한다.
- `useEffect`는 외부 시스템과 동기화할 때 사용한다. 클릭, 제출 같은 사용자 사건은 event handler에서 처리한다.
- URL로 공유·복원되어야 하는 검색어, filter, page, tab은 URL 상태로 관리한다.
- 서버 데이터는 Server Component에서 가져오는 것을 기본으로 한다.
- Client Component에는 렌더링에 필요한 필드만 전달해 RSC 직렬화 크기와 계약 면적을 줄인다.
- 전역 상태는 여러 route의 Client Component가 동일한 즉시 변경 상태를 공유해야 할 때만 도입한다.
- Context provider는 필요한 subtree에 최대한 가깝게 둔다.
- 독립적인 비동기 작업은 순차 await 대신 `Promise.all` 등으로 병렬 실행한다.
- 느린 독립 영역은 `Suspense` 경계를 사용해 전체 화면 waterfall을 피한다.

## Next.js 경계

- App Router의 컴포넌트는 기본적으로 Server Component다.
- 상태, 이벤트, 브라우저 API가 필요한 가장 작은 경계에만 `"use client"`를 둔다.
- Client Component에 전달하는 props는 React가 직렬화할 수 있어야 한다.
- `params`, `searchParams`, `cookies()`, `headers()` 등 현재 버전의 비동기 API는 설치된 문서를 확인하고 사용한다.
- Server Action은 외부에 노출된 POST 진입점으로 취급한다. 함수 안에서 인증, 인가, 입력 검증을 다시 수행한다.
- 공개 API와 webhook은 Route Handler, 애플리케이션 내부 mutation은 Server Action을 우선 검토한다.
- DB, Redis, 메일, 외부 SDK 클라이언트는 모듈 최상위에서 생성하지 않고 getter 안에서 지연 초기화한다.
- proxy는 트래픽 제어에만 사용하며 유일한 인증·인가 경계로 삼지 않는다.

## 함수와 모듈

- 함수는 한 가지 변경 이유를 갖도록 작게 유지한다.
- boolean 인자가 둘 이상이거나 호출 의미가 불명확하면 옵션 객체를 사용한다.
- 정상 결과와 실패 결과가 중요한 도메인 로직은 반환 타입으로 드러낸다.
- 부수 효과를 수행하는 함수는 이름과 TSDoc에 그 사실을 드러낸다.
- 기본 export는 Next.js 특수 파일처럼 프레임워크가 요구하는 곳에 사용하고, 일반 모듈은 named export를 사용한다.
- feature 루트 `index.ts`는 외부 공개 계약만 내보낸다. feature 내부 코드가 barrel을 통해 우회 import하지 않는다.
- 외부 라이브러리의 대형 barrel import는 bundle과 개발 성능 영향을 확인하고 직접 import 또는 Next.js 최적화 설정을 사용한다.
- 순환 의존성이 생기면 지연 import로 숨기지 않고 책임과 의존 방향을 다시 나눈다.

## 입력, mutation, 오류

- 브라우저와 외부 시스템에서 들어오는 값은 경계에서 검증한다.
- Client 검증은 사용자 피드백용이며 Server Action과 Route Handler에서 같은 보안 조건을 다시 검증한다.
- Server Action은 인증, 인가, 입력 검증, mutation, cache 무효화 순서를 코드에서 분명히 드러낸다.
- 사용자에게는 복구 가능한 오류 메시지를 제공하고 내부 stack, SQL, secret, 외부 응답 원문을 노출하지 않는다.
- 예상 가능한 실패는 구조화된 결과로 표현하고 예상하지 못한 실패는 로깅 후 error boundary로 전달한다.
- 오류를 빈 배열이나 `null`로 바꿔 성공처럼 보이게 하지 않는다.
- retry는 멱등성 또는 중복 방지 근거가 있을 때만 적용한다.

## 스타일과 접근성

- Tailwind CSS와 theme token을 기본 스타일 수단으로 사용한다.
- 색상, 간격, radius, typography를 반복해서 임의 값으로 만들지 않고 공용 token이나 variant로 승격한다.
- 공용 UI primitive가 hover, focus-visible, disabled, loading, invalid 상태를 일관되게 소유한다.
- 의미에 맞는 HTML 요소를 먼저 사용하고 ARIA는 네이티브 의미를 보완할 때만 사용한다.
- 모든 입력은 연결된 label과 오류 설명을 제공한다.
- 클릭 가능한 요소는 키보드로도 조작할 수 있어야 하고 focus 표시를 제거하지 않는다.
- 이미지에는 목적에 맞는 `alt`를 작성하고 레이아웃 크기를 알 수 있으면 `next/image`를 사용한다.
- route 또는 주요 feature는 로딩, 빈 상태, 오류, 재시도 UI를 구현한다.
- 모바일 폭과 긴 한국어 문구에서 레이아웃이 깨지지 않는지 확인한다.

## 성능

- 성능 최적화는 측정이나 명확한 비용 근거를 바탕으로 한다.
- 독립 데이터 요청의 waterfall과 불필요하게 넓은 `"use client"` 경계를 우선 제거한다.
- 무거운 Client Component나 사용 빈도가 낮은 기능은 `next/dynamic`을 검토한다.
- `useMemo`, `useCallback`, `memo`는 습관적으로 넣지 않고 실제 계산 비용이나 재렌더 경계가 있을 때 사용한다.
- 단순 파생 값은 memoization보다 렌더 중 계산한다.
- analytics와 사용자 상호작용에 불필요한 third-party script는 초기 hydration 뒤에 로드한다.

## 테스트 가능한 코드

- 순수 비즈니스 계산과 부수 효과 orchestration을 분리한다.
- 테스트는 내부 함수 호출 횟수보다 사용자가 보는 결과와 공개 계약을 검증한다.
- 공용 컴포넌트는 주요 variant와 keyboard/disabled/loading 상태를 검증한다.
- Server Action과 Route Handler는 정상 흐름뿐 아니라 인증 실패, 검증 실패, 중복 요청을 검증한다.
- 버그 수정에는 같은 문제가 다시 발생하지 않도록 회귀 테스트를 추가한다.

## 주석 원칙

주석은 코드가 이미 보여주는 “무엇”을 반복하지 않고 코드만으로 보이지 않는 “왜”와 “경계”를 기록한다.

### 반드시 작성하는 주석

- 외부로 내보내는 함수와 클래스의 역할을 설명하는 TSDoc
- 비즈니스 규칙의 출처와 선택 이유
- 보안, 권한, 개인정보, 금액 계산의 비자명한 제약
- 순서가 바뀌면 안 되는 처리와 그 이유
- 호환성 유지, 임시 우회, 성능 trade-off의 근거
- 오류를 삼키거나 fallback하는 이유와 관찰 방법

```ts
/**
 * 사용자에게 표시할 환불 가능 금액을 계산한다.
 *
 * 결제사 수수료는 원거래 통화의 최소 단위에서 먼저 반올림해야 하므로
 * 최종 금액을 계산한 뒤 한 번에 반올림하지 않는다.
 */
export function calculateRefundAmount(input: RefundAmountInput) {
  // 결제사 정산 결과와 1원 차이가 생기지 않도록 수수료부터 확정한다.
  const roundedFee = roundProviderFee(input.providerFee);

  return input.paidAmount - roundedFee;
}
```

### TSDoc 작성법

- 첫 문장은 책임과 결과를 명확히 적는다.
- 타입에 이미 있는 정보를 `@param {string}`처럼 반복하지 않는다.
- 허용 범위, 단위, 부수 효과, 발생 가능한 오류가 중요할 때만 태그나 본문으로 보완한다.
- “처리한다”, “함수다”처럼 이름을 번역한 설명만 남기지 않는다.
- 한국어를 기본으로 쓰되 코드 식별자, 프로토콜, 외부 계약의 고유 용어는 원문을 유지한다.

### 금지하는 주석

- 코드 한 줄을 한국어로 다시 읽는 주석
- 주석 처리한 코드
- 근거 없는 `TODO`, `FIXME`, `XXX`
- 현재 구현과 다른 과거 동작 설명
- 커밋이나 PR에서 확인할 수 있는 변경 이력

남겨야 하는 후속 작업은 GitHub 이슈를 만든 뒤 아래 형식만 사용한다.

```ts
// TODO(#123): 결제사 응답에 새 상태가 추가되면 매핑을 확장한다.
```

## 자동 검사

- ESLint가 내보내는 함수와 클래스의 TSDoc 존재 여부, 설명, 정렬, 태그를 검사한다.
- ESLint가 `//` 뒤 공백을 검사한다.
- `npm run check:comments`가 이슈 번호 없는 TODO와 `FIXME`, `XXX`를 거부한다.
- 주석의 정확성과 충분성은 PR 작성자와 리뷰어가 함께 확인한다.
