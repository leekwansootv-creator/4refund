# 4refund

Next.js 16 App Router 기반 애플리케이션이다. 구현을 시작하기 전에 폴더 구조, 주석, 품질 게이트를 저장소 규칙으로 고정한다.

## 시작하기

```bash
nvm use
npm ci
npm run dev
```

로컬 주소는 기본값인 `http://localhost:3000`이다.

## 필수 검사

```bash
npm run check
```

이 명령은 포맷, ESLint, TypeScript, 폴더 구조, 주석, 검사 스크립트 테스트, 프로덕션 빌드를 순서대로 실행한다. GitHub Actions도 같은 명령을 사용한다.

## 엔지니어링 문서

- [엔지니어링 규칙 안내](docs/engineering/README.md)
- [폴더 구조와 의존성 방향](docs/engineering/architecture.md)
- [코드와 주석 컨벤션](docs/engineering/code-conventions.md)
- [로컬 검사와 CI 운영](docs/engineering/quality-gates.md)
- [기여 절차](CONTRIBUTING.md)

프레임워크 동작은 인터넷의 임의 예제가 아니라 설치된 `next@16.2.11`의 `node_modules/next/dist/docs/`를 우선 기준으로 삼는다.
