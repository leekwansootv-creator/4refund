# 간단 견적 운영 runbook

## 목적과 책임

이 문서는 루트 랜딩의 간단 견적 상담 제출을 운영하는 절차를 고정한다. Apps Script 배포 URL, Script ID, Spreadsheet ID는 이 문서·PR·이슈에 기록하지 않는다. 사람용 상담 업무 화면의 목표 구조는 [간단 견적 상담 목록 설계](../planning/quick-estimate-consultation-queue.md)를 따른다.

| 항목                     | 운영 기준                                   |
| ------------------------ | ------------------------------------------- |
| Apps Script·Sheet 소유자 | `QD-010`으로 승인된 이관수 Google 계정      |
| Sheet 접근자             | 소유 계정 한 명                             |
| 다중 인증                | 필수                                        |
| 장애 대응 담당자         | 이관수                                      |
| 정상 점검 주기           | 영업일마다 1회                              |
| 상담 운영 자동 점검      | 평일 09:00~18:00, 30분마다                  |
| 최초 연락 목표           | 접수 후 2업무시간 이내                      |
| 장애 대응 시작 상한      | 인지 후 1영업일                             |
| 개인정보 보유            | 접수일부터 1년, 목적 달성·철회 시 조기 파기 |
| 파기 대상 점검           | 월 1회                                      |
| 별도 export·backup       | 금지                                        |

## 선조회 전환 운영 안내

2026-09-04 선조회 흐름은 전용 milestone에서 구현·검증 중이며 운영 공개 전이다. [출시 검증 기록](quick-estimate-result-first-release-check.md)에서 실제 저장과 공개 조건을 확인한다.

- 업종·직원 수 조회와 결과 확인만으로는 `leads`, `상담 목록`, 신규 알림을 생성하지 않는다. 최종 상세 견적 상담 신청자만 저장한다.
- 상세 견적은 상담 안내이며 추가 정밀 금액 자동 산출을 뜻하지 않는다. 상담 목록 건수를 전체 조회 건수로 해석하지 않는다.
- 저장 여부 미확인 시 같은 요청 재시도를 안내한다. 새 신청은 중복 가능성이 있고 모달을 닫으면 기존 요청을 복원하지 않는다.
- payload·규칙·고지·시트·artifact 변경이 없는 이번 전환에는 Apps Script 재배포나 migration을 추가하지 않는다. 아래 배포 체크리스트의 Apps Script 반영 항목은 서버 변경이 있는 경우에 적용한다.

## 배포 전 점검

- [ ] `npm run check`가 통과했다.
- [ ] `npm run build:apps-script` 후 생성된 `Code.gs`와 `appsscript.json`을 승인 계정의 project에 반영했다.
- [ ] Web App 새 version의 실행 주체가 `Me`, 접근자가 `Anyone`이다.
- [ ] 배포 URL은 저장소 밖에서만 전달했다.
- [ ] 로컬 검증은 `.env.local`의 `NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL`로 주입했다.
- [ ] GitHub Actions secret `QUICK_ESTIMATE_APPS_SCRIPT_URL`에 같은 URL을 등록했다.
- [ ] Sheet 공유가 제한됨이고 소유 계정 외 접근자가 없다.
- [ ] `leads` 24개 header와 `codebook`, `lead_status` validation이 유지된다.
- [ ] 업종 규칙 전환 시 Apps Script가 운영 브라우저 version과 차기 version을 모두 재계산한다.
- [ ] `onEditQuickEstimateConsultation` 설치형 편집 트리거가 한 개만 존재한다.
- [ ] Script Property `QUICK_ESTIMATE_NOTIFICATION_RECIPIENT`가 승인 계정으로 설정됐다.
- [ ] `runQuickEstimateOperationsCheck` 시간 기반 트리거가 한 개만 존재한다.
- [ ] 신규 가짜 신청 메일에 접수 시각 외 개인정보가 포함되지 않았다.
- [ ] 아래 실제 저장 E2E와 Sheet 대조가 끝났다.

`NEXT_PUBLIC_` 값은 정적 JavaScript에 포함되므로 인증 비밀이 아니다. 다만 배포 URL을 저장소 이력과 PR에 남기지 않기 위해 로컬 env와 GitHub secret으로만 전달한다. `main` 배포 job은 URL이 없거나 Apps Script Web App 형식이 아니면 빌드를 시작하지 않는다.

### 업종 규칙 v1/v2 선배포

한국표준산업분류 대분류 21개 화면을 공개하기 전에 Apps Script가 기존 v1과 차기 v2를 모두 허용하는 version을 먼저 배포한다. endpoint는 저장소나 명령 기록에 직접 적지 않고 현재 PowerShell session의 환경 변수로만 주입한다.

```powershell
$env:QUICK_ESTIMATE_LIVE_E2E='1'
$env:QUICK_ESTIMATE_APPS_SCRIPT_URL='<승인 계정의 운영 Web App URL>'
npm run build
npx playwright test e2e/quick-estimate-rule-compatibility-live.spec.ts
```

검증 항목:

1. v1 `professional_services`와 v2 `N` payload가 각각 `ok: true`, `duplicate: false`로 끝난다.
2. 두 행의 `industry_code`와 `estimate_rule_version`이 payload와 일치한다.
3. 상담 목록에서 v1 `professional_services`는 `전문·사업지원 서비스`, v2 `N`은 `용역·파견·시설관리업`으로 표시된다.
4. v1/v2의 표시금액, 난수와 benchmark version이 서버 재계산 결과와 일치한다.
5. 알 수 없는 version과 version에 속하지 않는 업종은 `UNSUPPORTED_RULE`로 거절된다.

두 version의 실제 저장과 상담 목록 표시가 확인되기 전에는 브라우저 활성 규칙을 v2로 바꾸지 않는다. 테스트 행도 아래 개인정보 파기 절차 밖에서 임의 삭제하지 않는다.

## 스팸·quota 정책

### 브라우저와 Apps Script 검증

- 화면에 보이지 않는 `company-website` honeypot이 비어 있어야 한다.
- dialog를 연 뒤 제출까지 3초 이상, 2시간 이하여야 한다.
- 두 값은 Sheet에 저장하지 않는다.
- 클라이언트 검증은 우회 가능하므로 Apps Script가 같은 계약을 다시 검증한다.

### 제출 제한

Apps Script는 유효한 신규 payload에 다음 UTC 고정 구간 제한을 적용한다.

| 제한             | 기준       | 저장 방식                  |
| ---------------- | ---------- | -------------------------- |
| 전체 분당        | 10건       | Script Cache               |
| 전체 일일        | 100건      | Script Properties          |
| 같은 이메일+전화 | 시간당 3건 | SHA-256 key와 Script Cache |

- 같은 `request_id`의 6시간 이내 재시도는 횟수를 다시 차감하지 않는다.
- 이메일과 전화번호 원문은 cache key, Properties, 실패 로그에 저장하지 않는다.
- CAPTCHA와 별도 secret은 현재 사용하지 않는다.
- 제한 초과는 `RATE_LIMITED`로 응답하고 입력과 계산 결과를 유지한 재시도를 허용한다.
- 카운터 손상이나 Google service 오류는 임의 허용하지 않고 `INTERNAL_ERROR`로 축약한다.

이 제한은 서비스 보호용 초기 기준이며 Google의 실제 할당량을 늘리지 않는다. Apps Script 할당량은 계정 유형별로 다르고 변경될 수 있으므로 [Google Apps Script 공식 quota 문서](https://developers.google.com/apps-script/guides/services/quotas)와 실행 dashboard를 함께 확인한다.

## 실제 저장 E2E

실제 고객 정보를 사용하지 않는다. 테스트 회사명에는 `4refund E2E 삭제대상`, 이메일에는 `.test` 도메인을 사용한다.

```powershell
$env:QUICK_ESTIMATE_LIVE_E2E='1'
npm run build:e2e
npx playwright test e2e/quick-estimate-live.spec.ts
```

검증 항목:

1. 데스크톱 마케팅 미동의 제출이 `ok: true`로 끝난다.
2. 모바일 마케팅 동의 제출이 `ok: true`로 끝난다.
3. 화면 금액과 실제 payload를 대조하고 데스크톱 동일 요청 재전송이 `duplicate: true`인지 확인한다. keyboard·200% 확대 대응 viewport·reduced motion·axe는 일반 E2E에서도 실제 저장 없이 검사한다.
4. Sheet에서 두 행의 회사명·연락처·업종·직원 수·표시금액·난수·동의 version을 화면과 대조한다.
5. `marketing_agreed`, `marketing_channels`, `marketing_accepted_at`이 동의 여부에 맞는다.
6. Apps Script 실행 기록에 개인정보 원문이 없다.

테스트 행도 개인정보 처리 절차 밖에서 임의 삭제하지 않는다. 담당자가 대상 `lead_id`, 파기 사유와 승인자를 확인한 뒤 파기대장에 개인정보 없이 기록한다.

### 2026-08-10 운영 적용 검증 기록

승인 계정으로 운영 Apps Script와 Sheet를 다음 기준으로 검증했다. 배포 URL, Script ID, Spreadsheet ID와 테스트 연락처 원문은 기록하지 않는다.

| 검증 항목        | 확인 결과                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Apps Script 반영 | 생성된 `Code.gs`, `appsscript.json`을 반영하고 기존 Web App을 version 4로 갱신                              |
| Web App 권한     | 승인 계정으로 실행, 모든 사용자 접근 유지                                                                   |
| Sheet 권한       | 일반 액세스 없이 승인 계정 한 명만 접근하는 상태 유지                                                       |
| Script Property  | 알림 수신자를 승인 계정으로 설정                                                                            |
| 설치형 trigger   | `onEditQuickEstimateConsultation` 편집 trigger 1개, `runQuickEstimateOperationsCheck` 시간 기반 trigger 1개 |
| 실제 저장 E2E    | `npm run build` 후 실제 저장 Playwright 3개 시나리오 통과                                                   |
| 원본 저장        | 마케팅 미동의·동의 신청 2건의 업종, 사원 수, 표시금액, 난수, 계산 규칙·기준 버전과 동의 증빙 대조           |
| 상담 목록        | 두 신청 모두 신규 신청으로 생성되고 상담 담당자가 이관수로 고정 배정됨                                      |
| 신규 알림        | 접수 시각이 같은 알림 2건 수신, 본문에 접수 시각과 상담 목록 확인 안내만 포함                               |
| 운영 점검        | 업무 시간 중 수동 실행 완료, 누락 복구와 알림 실패가 없어 운영 확인 메일을 보내지 않음                      |

원본 저장 대조에서 마케팅 미동의 행은 허용 방법이 비어 있고, 동의 행은 이메일·문자 허용으로 저장됐다. 두 행 모두 개인정보 처리 동의는 참이며 서로 다른 난수와 표시금액을 보존했다. 테스트 행은 회사명에 `4refund E2E 삭제대상` 표시를 유지하며 이 검증에서 삭제하지 않았다.

### 2026-08-25 업종 규칙 v2 운영 검증 기록

승인 계정의 기존 Web App URL과 접근 권한을 유지한 채 생성된 `Code.gs`와 `appsscript.json`을 version 6으로 배포했다. endpoint와 테스트 연락처 원문은 기록하지 않는다.

| 검증 항목        | 확인 결과                                                                       |
| ---------------- | ------------------------------------------------------------------------------- |
| Apps Script 반영 | 업종 규칙 v2 브라우저 활성화 artifact를 version 6으로 배포                      |
| v1/v2 호환       | v1 `professional_services`, v2 `N` 실제 저장 2개 시나리오 통과                  |
| 공개 화면 v2     | desktop 미동의, mobile 마케팅 동의 실제 저장 2개 시나리오 통과                  |
| 접근성           | keyboard, 200% 확대, reduced motion, dialog axe 시나리오 통과                   |
| 원본 저장 대조   | `industry_code`, 인원, 표시금액, 200bp, 규칙·benchmark version과 동의 값 확인   |
| 상담 목록        | v2 `N`을 `용역·파견·시설관리업`으로 표시하고 신규 신청·이관수 담당 상태 확인    |
| 거절 경계        | 알 수 없는 version과 v2 version의 v1 업종 코드 조합을 `UNSUPPORTED_RULE`로 거절 |
| 신규 알림        | 실제 저장 v1/v2·desktop·mobile 신규 신청과 같은 접수 시각에 알림 4건 수신       |

실제 저장 검증은 `npm run build` 후 두 live Playwright 파일의 5개 시나리오를 실행해 통과했다. 테스트 행은 개인정보 파기 절차 밖에서 삭제하지 않는다.

## 영업일 점검

신규 신청은 승인 계정에서 같은 계정으로 즉시 이메일 알림을 보낸다. 제목은 `[포리펀드] 새 상담 신청이 접수되었습니다`이며 본문에는 접수 시각과 상담 목록 확인 안내만 포함한다. 회사명, 고객 담당자, 전화번호, 이메일, 예상 환급액은 메일로 보내지 않는다. 중복 `request_id` 재시도에는 알림을 다시 보내지 않는다.

시간 기반 trigger는 평일 09:00~18:00에 30분마다 상담 목록 누락과 이전 알림 실패를 확인한다. 누락 행을 복구했거나 알림 실패가 누적된 경우에만 개인정보 없는 운영 확인 메일을 보낸다. 운영 확인 메일이 성공하면 전달이 끝난 실패 집계를 지우고, 메일 발송이 다시 실패하면 다음 점검을 위해 횟수·공개 코드·마지막 실패 시각만 Script Property에 유지한다.

1. Apps Script dashboard의 최근 실행에서 `Failed`와 비정상적으로 긴 `Running`을 확인한다.
2. 실패 로그의 공개 코드, 발생 시각, 검증된 `request_id`만 확인한다.
3. `leads`의 신규 행과 마지막 정상 접수 시각을 확인한다.
4. `RATE_LIMITED`가 반복되면 분·일·연락처 제한 중 어떤 구간인지 코드와 실행 시각으로 재현한다. 연락처 원문을 로그에 추가하지 않는다.
5. `STORAGE_UNAVAILABLE`, quota 예외 또는 신규 행 단절이 있으면 아래 장애 절차를 시작한다.

업무 시간 외 신규 신청은 즉시 알림을 받더라도 다음 영업일 오전 10시까지 상담 목록에서 확인한다. 최초 연락 목표는 접수 후 2업무시간 이내다.

## 장애 대응과 접수 중단

### 즉시 중단

1. 승인 계정의 Apps Script에서 **Deploy → Manage deployments**를 연다.
2. 운영 Web App deployment를 보관 처리하거나 접근 권한을 소유자 전용으로 바꾼다.
3. 신규 익명 `POST`가 성공하지 않는지 가짜 payload로 확인한다.
4. 장애 시각, 영향 구간, 마지막 정상 `request_id`를 개인정보 없이 기록한다.

프런트엔드는 최대 15초 뒤 timeout·network 실패로 안내하며 성공으로 표시하지 않는다. 접수 중단이 길어지면 `main`에서 공개 연결 commit을 revert해 이전 정적 Hero를 다시 배포한다. 코드 롤백은 이미 저장된 Sheet 행을 수정하거나 삭제하지 않는다.

### 복구

1. 원인을 schema, rate limit, Google quota, Sheet 권한·header, deployment version으로 구분한다.
2. 수정한 `Code.gs`를 새 version으로 배포한다. 기존 version을 덮어쓴 것으로 간주하지 않는다.
3. `.test` 데이터로 정상·동의·중복 재시도를 확인한다.
4. 새 URL이면 로컬 env와 GitHub secret을 함께 갱신한다.
5. 실제 저장 E2E와 Sheet 대조 후 접수를 재개한다.

## 권한·보유·파기

- Sheet는 공개 링크 공유를 금지하고 소유 계정 한 명만 접근한다.
- 초기 상담 담당자는 이관수 한 명이며 신규 상담은 `상담 목록`에서 이관수에게 고정 배정한다.
- 상담 담당자는 원본 `leads`를 수정하지 않고 한글 `상담 목록`의 허용 컬럼만 운영한다.
- 월 1회 `submitted_at` 기준 1년 만료와 조기 파기 요청을 확인한다.
- 파기 사유 확인 후 최대 5영업일 안에 처리한다.
- 파기대장에는 `lead_id`, 파기일, 파기 사유만 기록한다.
- Sheets version history 때문에 행 삭제만으로 복구 불가능한 파기를 단정하지 않는다. 실제 영구 파기는 대상 분리, 새 파일 교체, 기존 파일 영구 삭제 절차를 별도 승인 후 수행한다.
- 소유 계정 복구 수단이나 접근자가 바뀌면 공개 접수를 먼저 중단하고 권한 기준을 다시 승인한다.

저장소에는 사람용 `상담 목록` 생성, 원본 투영, 상담 상태 자동화와 개인정보 없는 알림 코드가 포함되어 있다. 다른 상담 담당자에게 이관수 계정 자격 증명을 공유하지 않는다. 다른 계정을 추가하기 전에는 개인별 계정, 편집 범위, 권한 회수와 배정 규칙을 다시 승인한다. 원본 24개 컬럼은 수정하지 않고 상담 담당자는 한글 업무 화면에서만 허용된 운영값을 변경한다.

## 변경과 rollback 기록

- Apps Script 배포 version, 프런트엔드 commit SHA, benchmark version을 한 release 기록에 묶는다.
- Sheet schema 변경은 기존 header 직접 편집이 아니라 별도 migration 계약으로 처리한다.
- 계산 규칙 rollback은 기존 행의 `estimate_rule_version`, `benchmark_version`을 보존한다.
- 운영 URL, Script ID, Sheet ID와 개인정보는 release 기록에 포함하지 않는다.
