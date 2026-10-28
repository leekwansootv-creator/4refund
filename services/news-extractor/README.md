# 독립 뉴스 수집기

기사 URL에서 제목·이미지를 가져오는 서버 간 경계다. CMS·Google 자격 증명을 사용하지 않는다.
현재 로컬 구현·테스트 상태이며 호스팅·HTTPS·운영 계정·배포를 설정하지 않았다.

## 실행

Python 3.13, Pillow 13, 의존성은 uv.lock에 고정한다.

```powershell
uv sync --locked
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
# NEWS_EXTRACTOR_TOKEN은 저장소 밖의 환경/비밀 저장소에서 제공한다.
uv run python -m news_extractor.server
```

기본 127.0.0.1:8765이며 PORT로 로컬 포트를 지정한다. 토큰이 없거나 32자 미만이면 시작하지 않는다.
이 서버는 개발용 HTTP 경계다. 운영은 TLS reverse proxy, 연결 제한, 비밀 관리, 프로세스 감시,
Authorization/본문 비기록, 리소스 제한·갱신 담당자를 정한 뒤 검증한다. 직접 인터넷에 노출하지 않는다.

## 계약

```text
POST /extract
Authorization: Bearer <server-side-secret>
Content-Type: application/json
```

```json
{ "url": "https://news.example.org/article", "imageOnly": false }
```

성공은 url/title/image(검증된 JPEG base64 또는 null)/warning/fingerprint만 반환한다.
imageOnly: true는 수동 대표 이미지 URL 검증이다. TITLE_MISSING, IMAGE_MISSING,
IMAGE_UNAVAILABLE 경고는 시트에서 수동 보정할 수 있다.

한국어 기사 인코딩은 BOM, HTTP charset, HTML 첫 1 KiB의 meta 순서로 확인한다.
EUC-KR/Windows-949의 확장 한글도 보존한다. 지원하지 않는 선언은 UTF-8로 읽는다.
대표 이미지 메타데이터가 없는 기사에서 광고나 본문 첫 사진을 자동으로 채택하지 않는다.
관리자가 본문 사진을 확인하고 이미지 URL을 입력하면 동일한 목적지·디코드 검증을 거친다.

| HTTP | 의미                                      |
| ---- | ----------------------------------------- |
| 401  | 토큰 불일치, 본문/수집 전 거절            |
| 400  | JSON/필드/크기/콘텐츠 타입 오류           |
| 404  | 다른 경로                                 |
| 429  | 전체 서비스 분당 10회 초과                |
| 422  | 목적지/수집/이미지 실패, 원문 오류 비공개 |

입력 4 KiB, 수집 동시 실행 1개, 연결 대기 큐 4개, 소켓 idle 5초/전체 연결 30초 제한이다.
자식 수집 프로세스는 20초 후 종료하며 토큰·환경 프록시를 상속하지 않는다. 모든 DNS 응답을
검사하고 IP 소켓에 연결을 고정하며 원래 호스트의 TLS 인증을 확인한다. 리다이렉트 3회까지 매번
재검증한다. 사설·로컬·메타데이터·IPv4 매핑/전환 주소를 차단한다.

HTML 1 MiB, 이미지 원본 4 MiB(압축/해제 모두), 1,200만 화소, 단일 프레임 JPEG/PNG/WebP만
허용한다. 최대 820×550 JPEG로 EXIF를 제거해 재인코딩하며 70 KiB 초과는 거절한다.
SVG/GIF/동영상·JS 렌더링·봇 차단 우회는 지원하지 않는다. 원문 접근 제한은 수동 수정으로 보완한다.

테스트는 가짜 DNS/socket/HTTP와 로컬 가짜 collector를 사용한다. 실제 기사나 Google 운영 시스템에
요청하지 않는다. 실제 운영 호스트 DNS/TLS/쿼터/CORS 성공의 증거로 해석하지 않는다.
