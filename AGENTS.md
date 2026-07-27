<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 필수 작업 순서

1. `.cursor/rules/00-project-conventions.mdc`를 읽는다.
2. `docs/engineering/README.md`와 작업에 해당하는 세부 문서를 읽는다.
3. Next.js 코드를 수정하기 전에 설치된 버전의 관련 문서를 `node_modules/next/dist/docs/`에서 읽는다.
4. 폴더 구조와 의존성 방향은 `docs/engineering/architecture.md`를 따른다.
5. 내보내는 함수와 클래스, 비자명한 제약은 `docs/engineering/code-conventions.md`에 맞게 주석을 작성한다.
6. 작업을 마치기 전에 `npm run check`를 실행한다.

문서와 자동 검사가 충돌하면 더 엄격한 규칙을 임의로 우회하지 않는다. 같은 변경에서 문서와 검사 코드를 함께 정정한다.
