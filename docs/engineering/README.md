# 엔지니어링 규칙

이 디렉터리는 4refund 코드베이스의 단일 규칙 원본이다. 사람, Cursor, Codex, CI가 같은 문서를 읽고 같은 명령으로 검증하는 것을 목표로 한다.

## 적용 우선순위

1. 설치된 Next.js 16.2.11의 `node_modules/next/dist/docs/`
2. 이 디렉터리의 프로젝트 규칙
3. 개별 코드의 지역적 패턴

프로젝트 규칙은 Next.js의 허용 범위 안에서 더 좁은 선택을 고정한다. 프레임워크 문서와 충돌하면 관련 문서를 다시 확인하고 프로젝트 규칙과 자동 검사를 함께 수정한다.

## 문서 지도

| 문서                                       | 결정하는 내용                               |
| ------------------------------------------ | ------------------------------------------- |
| [architecture.md](architecture.md)         | 폴더 책임, 파일 배치, 의존성 방향, 공개 API |
| [code-conventions.md](code-conventions.md) | TypeScript, Next.js 경계, 이름, 주석        |
| [quality-gates.md](quality-gates.md)       | 로컬 명령, CI, 테스트와 배포 기준           |

## 고정 도구 체인

| 항목       | 기준                                |
| ---------- | ----------------------------------- |
| Node.js    | 22.15.x                             |
| npm        | 10.9.x                              |
| Next.js    | 16.2.11                             |
| React      | 19.2.4                              |
| TypeScript | strict + 추가 안전성 옵션           |
| 포맷       | Prettier + Tailwind CSS 클래스 정렬 |
| 정적 검사  | ESLint + 프로젝트 구조/주석 검사    |

정확한 의존성은 `package-lock.json`, 실행 버전은 `.nvmrc`와 `package.json`의 `engines`를 기준으로 한다.

## 규칙 변경 원칙

- 문서만 바꾸거나 검사만 바꾸지 않는다.
- 새 폴더 유형을 추가하면 `architecture.md`와 `scripts/check-architecture.mjs`를 함께 수정한다.
- 주석 정책을 바꾸면 `code-conventions.md`, ESLint 또는 `scripts/check-comments.mjs`를 함께 수정한다.
- CI 명령을 바꾸면 `quality-gates.md`, `package.json`, GitHub Actions를 함께 수정한다.
- 일시적 예외는 설정 비활성화 대신 근거와 종료 조건이 있는 이슈로 관리한다.
