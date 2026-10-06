# 개발 방향과 API 대응표

참고 기준은 첨부된 [프론트 API handoff](sources/m1-frontend-api-handoff.md)와 [백엔드 handoff](sources/m1-backend-handoff.md)의 2026-10-03, SHA `ee2fcbaea14026fec46ba9b1ab785844b1fa627c`다. 현재 운영 API 또는 최신 main을 이번 수집에서 검증한 것은 아니다. 디자인은 2026-10-06 저장본이다.

## 개발 방향

M1의 사용자 흐름은 **발급 계정 로그인·OTP → 자료 입력·업로드·재개 → 사전 검사·접수 → 작업 목록·결과 → 신고 배정·최소 인계·종료**다. 점검·복구·지원 안내를 각 흐름에 포함한다.

화면은 Figma P0, 업무 계약은 확정한 API 후보를 기준으로 맞춘다. 차이가 있으면 디자인 샘플로 서버 정책을 덮어쓰거나 새 API를 임의로 만들어 맞추지 않는다. 아래 차이 목록을 담당자 협의 항목으로 사용한다.

현재 이 저장소는 Next.js 정적 export를 GitHub Pages에 배포한다. CMS의 인증 쿠키·허용 Origin·CSRF와 연동할 실제 호스트를 확정해야 한다. 구현 시 `src/app`은 라우팅, `src/features/<feature>`는 업무 흐름, `src/shared`는 업무 중립 UI를 담당한다. CMS 백엔드/Agent 코드와 공개 사이트의 배포 경계를 혼합하지 않는다.

handoff의 과거 '화면 설계를 시작하지 않는다' 등 문장은 당시 인계 범위 설명이며, 이번 사용자가 요청한 디자인 자료 정리를 금지하는 지시로 취급하지 않는다. 단, 아래 M1 범위는 개발 계획에 유용한 참고 기준으로 보존한다.

## 화면과 진입 API

모든 API 앞에 `/api/v1`을 붙인다. 완전한 endpoint 명세는 첨부 원본을 참고한다.

| 화면                  | API 진입점                                                                                                                                                                                                             | 클라이언트 처리                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 로그인·OTP·최초 설정  | `GET /auth/csrf`, `POST /auth/login`, `/auth/setups/resume`, `/auth/setups/complete`, `/auth/otp/enrollments`, `/auth/otp/enrollments/{enrollment_id}/confirm`, `/auth/otp/verify`                                     | `next_action`에 따라 다음 화면 결정                    |
| 내 계정·로그아웃·복구 | `GET /me`, `POST /auth/logout`, `/auth/recovery-codes/verify`, `/auth/recovery-codes/issue`                                                                                                                            | 쿠키 회전 후 CSRF 갱신, 키/코드 로그 금지              |
| 계정 관리             | `GET/POST /users`, `GET /users/{user_id}`, `PUT /users/{user_id}/roles`, `PATCH /users/{user_id}/affiliation`, `POST /users/{user_id}/setup-deliveries`                                                                | 허용 행동·현재 version, 발급과 메일 결과 분리          |
| 회사·자료 입력        | `GET /companies`, `POST /upload-sessions`, `PATCH /upload-sessions/{id}/input-profile`                                                                                                                                 | 회사·operation·입력 방식·자료 역할 일치                |
| 파일·이어하기         | `POST /upload-sessions/{id}/file-transfers`, `GET /file-transfers/{id}`, `PATCH /file-transfers/{id}/content`, `POST /file-transfers/{id}/complete`, `GET /upload-sessions`, `GET /upload-sessions/{id}`               | 위치·generation·해시 확인, 업로드와 접수 분리          |
| 백업암호              | `PUT /upload-sessions/{id}/backup-secret`                                                                                                                                                                              | 전용 경계로 전송, 파일/로그에 합치지 않음              |
| 검사·접수             | `POST /work-submission-checks`, `POST /work-requests`                                                                                                                                                                  | 일치한 `check_id`, 경고 확인, 동일 요청 재시도 키 유지 |
| 작업·결과             | `GET /work-requests`, `GET /work-requests/{id}`, `GET /work-requests/{id}/files`, `GET /work-requests/{id}/files/{file_id}/content`                                                                                    | cursor, 권한, 보관·결과 이용 상태, 실제 파일 목록      |
| 신고 업무             | `GET /claim-cases`, `GET /claim-cases/{claim_id}`, `PUT /claim-cases/{claim_id}/assignment`, `/claim-cases/{claim_id}/handoff`, `POST /claim-cases/{claim_id}/closures`, `/claim-cases/{claim_id}/closure-corrections` | expected_version·사유·최소 인계·실제 종료일            |
| 지원·점검             | `GET /support-contact`, 상세 `service_state`                                                                                                                                                                           | 새 접수 제한과 기존 조회를 구분                        |

## 계약에서 유지할 타입·상태

- UUID·날짜·UTC 시각 타입 유지. 금액·버전·바이트·순번 bigint는 십진 문자열로 교환한다. 임의 필드를 추가하지 않는다.
- operation은 `estimate_refund` / `prepare_claim`. 첨부 계약은 `scope_kind="all"`, 빈 `scope_payload`만 지원한다.
- 예상 조회 기간은 시작 월초부터 3개월 말일, 본 청구는 1월 1일~3개년 12월 31일이다.
- 전체 SHA-256 메타데이터는 hex, 청크 `Upload-Checksum`은 `sha256 <base64>`. `Upload-Offset`, `Transfer-Generation`, octet-stream 본문 계약을 지킨다.
- `SUBMISSION_RECHECK_REQUIRED`: 재검사. `WARNING_ACK_REQUIRED`: 반환 경고 확인. `IDEMPOTENCY_KEY_REUSED`: 자동 재시도 중단. `EXECUTION_UNCERTAIN`: 새 요청으로 우회 금지.
- `AUTH_REQUIRED`: 재로그인. `MFA_REQUIRED`: 인증 단계 이동. `FORBIDDEN`: 접근 거절. 숨겨진 자료의 404는 실제 부재를 확정하지 않는다.
- `VERSION_CONFLICT`: 최신 상태를 받아 사용자 재확인. `MAINTENANCE`·`POLICY_NOT_CONFIGURED`: 빈 결과/성공으로 표시하지 않는다.
- RPA 완료, 결과 저장·검증, 업무 환급 완료, 다운로드 이용 종료, 최종 파기를 분리한다.

## 디자인과 계약의 차이·확인 항목

| 항목                              | 디자인 근거                                                           | handoff 기준                           | 구현 방향/미결                                                                              |
| --------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| 일부 직원·부서 범위               | `920:9467`, `920:9628`, `920:9773`                                    | 전체 범위만 허용                       | 디자인 기록은 보존. 부분 선택 활성화 전 지원 계약 필요                                      |
| 목록 페이지 번호                  | Pagination `538:18133`, 작업·계정 목록                                | 작업 목록 cursor                       | cursor 이동 기록과 번호 UI의 대응 결정. 총 페이지를 임의 계산하지 않음                      |
| 예상 조회 종료월                  | MonthRangeField 설명 '종료 연월 +3개월', 같은 설명에는 '선택한 3개월' | 시작 월 포함 3개월의 말일              | 예: 1월 시작 → 3월 말인지 실제 계약/디자인 재확인. 설명 한 문장만 보고 4개월 범위 생성 금지 |
| 일자 선택 컴포넌트 설명           | DayField `722:14435` 설명이 '연도 입력'으로 되어 있음                 | 업무 종료는 실제 일자                  | 컴포넌트 이름·화면·DTO가 일자 선택을 요구. 복사된 설명 가능성은 미확정                      |
| 신고 인계                         | `709:6738`                                                            | 최소 DTO `pension_status`, Q-03 미결   | 필수 정보·첨부를 실무 담당과 확정 후 필드/API 연결                                          |
| 보관·파기 정책                    | 완료/종료 화면의 샘플 기한 및 상태                                    | 기준 main에 post-M1도 섞임             | 배포 후보 정책과 서버값 사용. 30일 등 예시를 고정 정책으로 채택 금지                        |
| 내 계정 수정·비밀번호 변경/재설정 | `771:8040`, `771:12585`, 인증 섹션                                    | handoff API 목록은 전체 목록이 아님    | 필요한 endpoint·검증 규칙·운영 승인·세션 회전 계약 추가 확인. API 부재로 단정하지 않음      |
| 계정 역할 발급·회수               | 운영진·개발자 계정 생성/상세                                          | 일반 노무사 운영 분기 확정 필요        | 허용 역할 조합·소속·관리 행동을 서버 기준으로 제한                                          |
| 접수/계정 생성 결과 불명          | `619:30113`, `923:20919`                                              | 중복 방지·응답 유실 복구               | 결과 조회 방식과 idempotency 적용 범위 확인. 생성 재요청으로 대체 금지                      |
| 결과 파일·금액                    | `813:10065`, `923:20145`                                              | 실제 두 기능 산출물 E-01 미결          | 샘플 금액·파일 개수 고정 금지. 0원·무조정·부분 실패 실계약 필요                             |
| 지원 이메일                       | 여러 버튼의 이메일 이동 주석                                          | `GET /support-contact`, E-03 미결      | 운영 연락 경로 연결. 예시 URL 사용 금지                                                     |
| CMS 배포                          | 로그인·API 통신 필요                                                  | 현재 프론트 저장소는 Pages 정적 export | 실제 연동 URL·허용 Origin·쿠키·HTTPS·환경 구성을 확정                                       |

## 후속 범위와 인수

handoff 기준 후속 범위: SMS, 자료 인수 기반 새 기한/CR-002, 일괄 계정 발급, 취소, 고급 검색, 알림, 문의함, PC 운영 대시보드. 현재 P0 수집에 화면이 있다는 이유만으로 모두 이번 구현 범위로 확대하지 않는다. 기존 M1 보관·복구·점검 의무는 유지한다.

실제 연동 전에 배포 후보 SHA, 테스트 URL/계정, 허용 Origin, 조립된 인증·파일·메일 포트를 받아야 한다. 실제 RPA·두 PC·이메일·보관/복원/파기·브라우저 권한 인수는 이 디자인 자료 수집으로 완료되지 않는다.
