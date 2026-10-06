# 10월 5일 별도 프론트 설계자에게 전달할 M1 API 계약

기준: main `ee2fcbaea14026fec46ba9b1ab785844b1fa627c`, 2026-10-03. 코드의 라우트·DTO를 정적으로 대조한 백엔드 인계다. 10월 5일 월요일 프론트 설계는 사용자가 별도 담당자와 진행한다. 이번 작업은 화면 기획·디자인을 시작하거나 결정하지 않는다. 실제 운영 API 접속이나 브라우저 인수를 완료했다는 뜻도 아니다. 범위 근거는 기존 [화면 우선순위][roadmap]의 P0-01~10이다.

현재 [운영 API 문서][api-doc]와 화면 명세에는 post-M1 개정도 섞여 있다. SMS/휴대폰 변경·인수 확인·새 자료 기한·일괄 계정 발급은 이번 필수 화면에서 제외한다. 기존 M1 OTP와 보관 계약은 기준 기록으로 읽되, 실제 연동 후보가 확정되기 전에 현재 main의 응답을 과거 계약으로 강제 해석하지 않는다.

## 최소 화면과 실제 선언된 API

모든 경로 앞에 `/api/v1`을 붙인다. 아래는 화면 구현에 필요한 진입점이며 전체 API 목록은 아니다.

| 화면/흐름                | 메서드·경로                                                                                                                                                                                                            | 프론트가 지켜야 할 계약                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 로그인·최초 설정·OTP     | `GET /auth/csrf`, `POST /auth/login`, `/auth/setups/resume`, `/auth/setups/complete`, `/auth/otp/enrollments`, `/auth/otp/enrollments/{enrollment_id}/confirm`, `/auth/otp/verify`                                     | 응답 `next_action`에 따라 이동. 등록→복구 코드 발급까지 별도 단계. 서버 단계와 현재 역할을 추정하지 않음                       |
| 내 계정·로그아웃·복구    | `GET /me`, `POST /auth/logout`, `/auth/recovery-codes/verify`, `/auth/recovery-codes/issue`                                                                                                                            | 복구 코드·OTP 키는 필요 화면에서만 표시. 로그/분석 도구로 전송하지 않음. 쿠키 회전 후 CSRF 갱신                                |
| 최소 계정 발급/관리      | `GET/POST /users`, `GET /users/{user_id}`, `PUT /users/{user_id}/roles`, `PATCH /users/{user_id}/affiliation`, `POST /users/{user_id}/setup-deliveries`                                                                | 권한별 허용 행동·현재 version 사용. 일반 노무사 발급/회수의 운영 분기는 확정 범위 확인. 일괄 발급 제외                         |
| 회사·자료 입력           | `GET /companies`, `POST /upload-sessions`, `PATCH /upload-sessions/{id}/input-profile`                                                                                                                                 | 회사명·사업자번호, 두 operation, 입력 방식/자료 역할을 DTO에 맞춤. 작성자/권한은 서버 판단                                     |
| 업로드·기본 이어하기     | `POST /upload-sessions/{id}/file-transfers`, `GET /file-transfers/{id}`, `PATCH /file-transfers/{id}/content`, `POST /file-transfers/{id}/complete`, `GET /upload-sessions`, `GET /upload-sessions/{id}`               | 수신 위치·generation·해시 확인 후 이어하기. 전송 완료와 업무 접수를 분리. 미접수 자료 상태/기한/재개 제공                      |
| 최종 확인·접수           | `POST /work-submission-checks`, `POST /work-requests`                                                                                                                                                                  | 같은 입력의 `check_id`와 반환된 경고를 확인하고 접수. 같은 논리 요청 재시도는 동일 Idempotency-Key; 내용을 바꾸면 재검사       |
| 기본 목록·상세·결과      | `GET /work-requests`, `GET /work-requests/{id}`, `GET /work-requests/{id}/files`, `GET /work-requests/{id}/files/{file_id}/content`                                                                                    | cursor 목록. `assignment`, `retention`, `service_state`, `allowed_actions`를 반영. 상태 성공/금액 0/금액 없음·파일 없음은 구분 |
| 신고 배정·최소 인계·종료 | `GET /claim-cases`, `GET /claim-cases/{claim_id}`, `PUT /claim-cases/{claim_id}/assignment`, `/claim-cases/{claim_id}/handoff`, `POST /claim-cases/{claim_id}/closures`, `/claim-cases/{claim_id}/closure-corrections` | 배정은 대상+expected_version+사유. 현재 최소 인계 DTO는 pension_status. 업무 종료는 실제 일자·종류·전체 청구 확인을 구분       |
| 점검/지원 안내           | 작업 상세의 `service_state`, `GET /support-contact`                                                                                                                                                                    | 신규 접수 제한과 기존 자료 조회를 구분. M1 지원은 기존 연락 경로; 문의함·PC 대시보드는 후속                                    |

라우트와 응답 원본: [인증 라우터/응답][identity]·[인증 DTO][identity-dto]·[업로드 라우터][files]·[업로드 DTO][files-dto]·[접수 라우터][requests]·[접수/상세 DTO][request-dto]·[신고 라우터][claims]·[신고 DTO][claim-dto]. `/claim-cases`는 신고 라우터의 실제 prefix다. Agent 보고 API는 브라우저 업무 API로 사용하지 않는다.

## 입력·상태·오류에서 놓치지 않을 부분

- 공통: HTTPS 세션 쿠키, 허용 Origin, CSRF. 서버가 권한·귀속을 재검증한다. UUID/날짜/UTC 시각의 타입을 유지하고, 버전·금액·바이트·순번의 bigint는 십진 **문자열**로 교환한다. 임의 추가 필드는 거절된다. [직렬화 코드][serialization]
- 입력: `operation`은 `estimate_refund`/`prepare_claim`. 현재 접수 DTO는 `scope_kind="all"`, 빈 `scope_payload`. 예상 조회는 월초부터 3개월 말일, 본 청구는 1월 1일부터 3개년 12월 31일이다. 검증되지 않은 부분 범위 선택 UI를 추가하지 않는다. `upload_session_id`, `upload_version`, 기간과 선택 참조를 사전 검사·접수에 일관되게 사용한다. [접수 DTO][request-dto]
- 파일: 메타데이터의 전체 파일 SHA-256은 hex, 청크의 `Upload-Checksum`은 `sha256 <base64>`이며 `Upload-Offset`, `Transfer-Generation` 헤더가 필요하다. `PATCH` 본문은 octet-stream. 백업암호는 전용 `PUT /upload-sessions/{id}/backup-secret`로 분리한다. 실제 전송 크기/청크 정책은 구현과 협의하고 화면에서 임의 확정하지 않는다. [업로드 구현][files]
- 접수: `SUBMISSION_RECHECK_REQUIRED`는 재검사, `WARNING_ACK_REQUIRED`는 반환 경고 확인, `IDEMPOTENCY_KEY_REUSED`는 자동 재시도 중단. `EXECUTION_UNCERTAIN`을 새 요청으로 우회하지 않는다.
- 권한: `AUTH_REQUIRED`는 재로그인, `MFA_REQUIRED`는 서버 인증 단계, `FORBIDDEN`은 접근 거절. 숨겨진 자료의 404를 ‘실제로 존재하지 않음’으로 단정하지 않는다. 배정 변경 뒤 상세/다운로드 권한을 다시 확인한다.
- 경합/보관: `VERSION_CONFLICT`면 최신 상태를 받아 사용자에게 재확인을 요청한다. 이용 만료·봉쇄·백업 보관·실제 파기 완료를 같은 문구로 처리하지 않는다. RPA 완료와 환급 완료도 별개다. `MAINTENANCE`/`POLICY_NOT_CONFIGURED`를 성공이나 빈 결과로 표시하지 않는다.

## 실제 연동 전에 받을 것

| 필요한 입력                                                             | 담당/판정 경계                                                                                                                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 연동 기준 SHA·테스트 URL·허용 Origin·테스트 계정·실제 runtime 포트 구성 | 백엔드/운영 담당. 이 문서는 환경 활성화 승인이 아님. 앱은 공개 `/openapi.json`·Swagger를 꺼 두므로 코드 DTO를 근거로 시작하고, 별도 안전한 계약 산출이 필요하면 범위부터 정함 |
| 로그인/OTP/복구의 실제 응답 및 사용할 기능 범위                         | 현재 main의 post-M1 정책 분기와 M1 화면 계약을 대조. SMS를 임의 추가하거나 보안 검사를 약화하지 않음                                                                          |
| Q-03 신고 인계의 최소 정보·첨부                                         | 신고 실무 담당 확인. 현재 pension_status DTO를 전체 업무 요건 확정으로 간주하지 않으며 미정 첨부 폼을 선구현하지 않음                                                         |
| 실제 두 기능 샘플·산출물/0원·무조정·부분 실패 표시                      | RPA 담당 E-01. 합성 샘플을 실제 인수로 표시하지 않음                                                                                                                          |
| 실제 발급/복구 메일·지원 연락 경로                                      | E-03 운영 담당. 실발송·실계정 사용은 승인된 인수에서 수행                                                                                                                     |
| 실제 보관·복원·파기 및 점검 안내 값                                     | 배포 후보/운영 담당. 과거 M1 기준을 현재 정책으로 되돌리거나 CR-002를 무조건 이번 필수로 확대하지 않음                                                                        |

연동에서 구분할 기존 응답 상태: 빈 목록/0원/권한 거절/세션 만료/OTP 미완료/중단 업로드/접수 경고/실행 불명/파일 이용 종료/점검/버전 충돌. 표시 방식·화면 구성은 별도 설계자가 결정한다. 고급 검색·취소·알림·문의함·SMS·새 인수 확인·일괄 발급은 기존 로드맵의 후속 범위다.

[roadmap]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/docs/product/roadmap.md
[api-doc]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/docs/engineering/api/operating-api-contract.md
[identity]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/identity/http.py
[identity-dto]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/identity/dto.py
[files]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/files/router.py
[files-dto]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/files/contracts.py
[requests]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/requests/api.py
[request-dto]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/requests/submission/contracts.py
[claims]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/claims/api.py
[claim-dto]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/claims/contracts.py
[serialization]: https://github.com/misosiruda/4refund-cms/blob/ee2fcbaea14026fec46ba9b1ab785844b1fa627c/backend/src/cms/core/serialization.py
