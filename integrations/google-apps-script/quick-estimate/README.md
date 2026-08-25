# 간단 견적 Google Sheets 저장 웹 앱

## 범위

이 integration은 정적 랜딩과 분리된 Google Apps Script 실행 경계다. form encoded `payload`를 검증하고 payload의 계산 규칙 version으로 금액을 재계산한 뒤, 승인된 24개 컬럼의 `leads` Sheet에 한 행을 저장한다. 저장된 원본은 `lead_id` 기준으로 한글 `상담 목록`에 투영한다.

포함 범위는 다음과 같다.

- `request_id` 중복 방지와 Script lock
- 개인정보 필수 동의와 선택 마케팅 동의 version 검증
- spreadsheet formula injection 방어
- 서버 기준 UTC ISO 시각과 초기 상태 `NEW`
- 개인정보 원문을 제외한 실패 로그
- v1 14개 업종과 v2 KSIC 대분류 21개 규칙의 명시적 version별 재계산
- honeypot·제출 소요 시간 재검증
- 분·일·연락처 해시 기반 제출 제한과 `RATE_LIMITED` 응답
- 원본과 분리된 한글 상담 목록 생성과 누락 행 재동기화
- 한글 상담 상태 전이 검증과 원본 `lead_status`, `handled_at` 동기화
- 이관수 고정 담당자 배정과 개인정보 없는 신규 상담 이메일 알림
- 평일 업무 시간의 30분 누락 행·알림 실패 자동 점검

React 화면과 브라우저 transport는 `src/features/quick-estimate`가 소유한다. 계정·배포·실저장 E2E와 장애 대응은 [운영 runbook](../../../docs/operations/quick-estimate-runbook.md)을 따른다.

알 수 없는 `ruleVersion`이나 해당 version에 없는 업종 코드는 `UNSUPPORTED_RULE`로 거절한다. 공개 브라우저는 v2를 사용하고 Apps Script는 이전 화면의 제출·재시도를 위해 v1과 v2를 모두 허용한다.

## 파일 책임

```text
quick-estimate/
├── src/              # 테스트 가능한 TypeScript 원본
├── Code.gs           # build script가 생성한 Apps Script 배포 파일
├── appsscript.json   # V8, Sheet scope, 웹 앱 실행 계약
└── README.md         # 계정·설정·검증·운영 절차
```

`Code.gs`는 직접 수정하지 않는다.

```bash
npm run build:apps-script
npm run check:apps-script
```

## 소유 계정과 접근

- Apps Script project와 Spreadsheet 소유자: `leekwansootv@gmail.com`
- 초기 Sheet 접근자: 소유 계정 한 명
- 링크 공개 공유: 금지
- 별도 CSV/XLSX export와 backup: 금지
- Script ID, Spreadsheet ID, 배포 URL: 저장소·PR·공개 로그 기록 금지

다른 계정으로 project나 Sheet를 만들었으면 운영 자산으로 사용하지 않고 승인 계정에서 다시 생성한다.

## 최초 설정

아래 작업은 반드시 `leekwansootv@gmail.com`으로 로그인한 Apps Script 편집기에서 수행한다.

1. 독립 실행형 Apps Script project를 만들고 이름을 `4refund 간단 견적 저장`으로 지정한다.
2. Project Settings에서 `Show "appsscript.json" manifest file in editor`를 켠다.
3. 저장소의 `appsscript.json` 내용으로 편집기의 manifest를 교체한다.
4. 저장소의 생성된 `Code.gs` 내용으로 편집기의 스크립트 파일을 교체한다.
5. Project Settings의 Script Properties에 `QUICK_ESTIMATE_NOTIFICATION_RECIPIENT`를 추가하고 승인된 이관수 계정 이메일을 값으로 설정한다.
6. 함수 목록에서 `setupQuickEstimateStorage`를 선택해 한 번 실행하고 Sheet, 메일 발송과 설치형 trigger 권한을 승인한다.
7. 반환값에서 `consultationEditTriggerCreated`, `consultationOperationsCheckTriggerCreated`를 확인하고 반환된 URL로 Sheet를 연다. 기존 설정을 갱신한 경우 `created`는 `false`가 정상이다. 반환된 ID와 URL은 저장소나 PR에 남기지 않는다.
8. Sheet가 첫 번째 `상담 목록`, `leads`, `codebook` 세 탭을 가지는지 확인한다.
9. `상담 목록` 첫 행이 16개 한글 header인지, 마지막 `상담 신청 번호` 열이 숨겨졌는지 확인한다.
10. `leads` 첫 행이 24개 고정 header인지, 23번째 `lead_status` 열에 네 상태의 validation이 설정됐는지 확인한다.
11. Apps Script의 Triggers 화면에서 `onEditQuickEstimateConsultation` 편집 trigger와 `runQuickEstimateOperationsCheck` 시간 기반 trigger가 각각 한 개만 존재하는지 확인한다.

같은 project에서 설정 함수를 다시 실행하면 Script Property에 보관된 기존 Spreadsheet를 사용한다. `상담 목록`이 없으면 새 탭을 만들고 기존 `leads` 중 빠진 행만 반영하며, 같은 `lead_id`의 행과 설치형 trigger를 중복 생성하지 않는다. 반환값의 `consultationSheetCreated`, `consultationEditTriggerCreated`, `consultationOperationsCheckTriggerCreated`, `syncedRows`로 생성·반영 건수를 확인할 수 있다.

이후 누락 행만 다시 확인할 때는 `syncQuickEstimateConsultationRows`를 실행한다. 이 함수는 원본 행을 수정하거나 상담 목록의 기존 업무값을 덮어쓰지 않으며 `createdRows`, `existingRows`, `skippedRows` 건수만 반환한다.

## 상담 상태 운영

설치형 편집 트리거는 상담 목록에서 한 번에 한 셀씩 수정한 경우에만 동작한다.

- `신규 신청`에서 `연락 중` 또는 결과가 `연락처 오류`·`중복 신청`인 `종결`로 변경할 수 있다.
- `연락 중`에서 결과가 `상담 완료`인 `상담 완료` 또는 종결 사유가 있는 `종결`로 변경할 수 있다.
- `상담 완료`, `종결`을 `연락 중`으로 되돌리는 작업은 Sheet 소유자만 수행할 수 있다.
- `연락 중`이 처음 된 시각만 `최초 연락 일시`와 원본 `handled_at`에 기록하고 이후에는 덮어쓰지 않는다.
- 상담 담당자는 30자 이내 이름, 다음 연락 예정일은 날짜·시각, 상담 결과는 한글 선택값만 허용한다.
- 잘못된 입력은 이전 값으로 되돌리고 해당 셀에 한글 사유를 남긴다.
- 원본 반영 실패 시 상담 목록 값은 보존하고 `원본 반영 대기` 메모와 개인정보 없는 오류 코드를 남긴다.

신규 상담 행의 `상담 담당자`는 승인된 초기 운영 기준에 따라 `이관수`로 생성한다. 신규 담당자가 추가되기 전까지 자동 분배와 순번 배정은 사용하지 않는다.

## 신규 상담 알림과 자동 점검

- 신규 원본 저장이 성공하면 `[포리펀드] 새 상담 신청이 접수되었습니다` 이메일을 보낸다.
- 본문에는 한국 접수 시각과 상담 목록 확인 안내만 포함한다.
- 회사명, 고객 담당자, 전화번호, 이메일, 예상 환급액은 메일에 포함하지 않는다.
- 메일 실패가 원본 저장 성공 응답을 취소하지 않는다.
- 중복 `request_id` 재시도에는 메일을 다시 보내지 않는다.
- 메일 실패는 횟수, 공개 코드와 마지막 실패 시각만 Script Property에 기록한다.
- `runQuickEstimateOperationsCheck`는 평일 09:00~18:00에 30분마다 실행해 상담 목록 누락과 알림 실패를 확인한다.
- 누락 복구 또는 누적 실패가 있을 때만 개인정보 없는 운영 확인 메일을 보낸다.

## 테스트 배포

Apps Script의 Deploy > New deployment > Web app에서 다음 값을 사용한다.

| 항목           | 값                            |
| -------------- | ----------------------------- |
| Execute as     | Me (`leekwansootv@gmail.com`) |
| Who has access | Anyone                        |

manifest의 `USER_DEPLOYING`과 `ANYONE_ANONYMOUS`는 이 실행 계약을 고정한다. 배포 URL은 환경 설정값으로만 다루며 저장소에 commit하지 않는다. 공개 랜딩에는 아직 연결하지 않는다.

fake 데이터로만 아래를 확인한다.

- 정상 payload: `ok: true`, `duplicate: false`, 한 행 저장
- 같은 `requestId` 재전송: 같은 `leadId`, `duplicate: true`, 행 수 유지
- 변조 금액 또는 필수 동의 누락: 실패 코드 반환, 행 수 유지
- `=`, `+`, `-`, `@`로 시작하는 fake 회사명: 수식이 아니라 일반 텍스트로 저장
- 같은 `leadId` 재동기화: 상담 목록 행 수 유지
- 상담 목록 쓰기 실패: 원본 `leads` 저장 성공 응답 유지
- 신규 저장 알림 수신과 중복 재시도 알림 미발송
- 신규 상담의 이관수 고정 배정
- 운영 점검의 누락 행 복구와 알림 실패 재전달
- 허용·거부 상태 전이와 소유자 전용 재개
- 최초 `연락 중`에서만 `handled_at` 기록
- 원본 상태 불일치와 쓰기 실패의 `원본 반영 대기` 처리

## 운영 계약

- 예상 제출량: 일 100건, 분당 10건
- 허용 상태: `NEW`, `CONTACTING`, `COMPLETED`, `CLOSED`
- 원본 제출 컬럼: 담당자 수정 금지
- 상담 목록 상태 자동화와 접근 계정 승인이 운영 환경에 적용되기 전까지 담당자 수정 금지
- 개인정보 보유: 접수일로부터 1년, 철회 또는 목적 달성 시 조기 파기
- 파기 대상 확인: 월 1회
- 파기 사유 확인 후 내부 처리 상한: 영업일 5일
- 마케팅 철회 상태 반영 상한: 영업일 3일
- 파기 로그: 개인정보 없이 `lead_id`, 파기일, 파기 사유만 별도 기록
- 자동 제출 방지: 빈 honeypot, 제출까지 3초 이상·2시간 이하
- 제출 제한: 전체 10건/분·100건/일, 같은 이메일+전화 해시 3건/시간
- 점검: 영업일마다 1회, 장애 대응 담당자 이관수, 인지 후 1영업일 안에 대응 시작
- 상담 확인: 평일 09:00~18:00에 30분마다, 최초 연락은 접수 후 2업무시간 이내

Google Sheets의 행 삭제는 version history에서 복구될 수 있으므로 영구 파기로 단정하지 않는다. 공개 전 승인 계정에서 보유 대상 분리, 새 파일 교체와 기존 파일 영구 삭제 절차를 실제로 검증해야 한다. 이 검증이 끝나기 전에는 운영 공개 승인을 완료한 것으로 처리하지 않는다.

## 장애와 롤백

- 저장 실패는 `STORAGE_UNAVAILABLE`로 축약하며 입력 원문이나 내부 stack을 응답하지 않는다.
- 실패 로그에는 오류 코드, 실행 시각, 검증된 요청의 `request_id`만 기록한다.
- Apps Script 배포를 중지하면 신규 제출만 차단된다.
- 코드 롤백은 기존 Sheet 행을 수정하거나 삭제하지 않는다.
- Sheet schema를 바꿔야 하면 기존 header를 즉시 수정하지 않고 별도 migration·호환 계약을 먼저 승인한다.
