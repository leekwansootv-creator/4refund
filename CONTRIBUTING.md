# 기여 가이드

## 작업 전

1. `npm ci`로 `package-lock.json`과 동일한 의존성을 설치한다.
2. `docs/engineering/README.md`에서 작업에 해당하는 규칙을 확인한다.
3. Next.js 기능을 사용한다면 `node_modules/next/dist/docs/`의 해당 가이드를 읽는다.

## 구현 중

- URL과 라우트 경계는 `src/app`에 둔다.
- 기능 구현은 `src/features/<feature>`에 둔다.
- 비즈니스 의미가 없는 공용 코드만 `src/shared`에 둔다.
- 내보내는 함수와 클래스에는 역할과 경계를 설명하는 TSDoc을 작성한다.
- 비자명한 분기에는 결과가 아니라 이유를 설명하는 주석을 작성한다.

## 제출 전

```bash
npm run format
npm run check
```

PR에서는 `.github/pull_request_template.md`의 폴더 구조와 주석 항목을 직접 확인한다. 규칙 변경은 문서, 검사 스크립트, CI를 같은 PR에서 함께 수정한다.
