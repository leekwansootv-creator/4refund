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
| 장애 대응 시작 상한      | 인지 후 1영업일                             |
| 개인정보 보유            | 접수일부터 1년, 목적 달성·철회 시 조기 파기 |
| 파기 대상 점검           | 월 1회                                      |
| 별도 export·backup       | 금지                                        |

## 배포 전 점검

- [ ] `npm run check`가 통과했다.
- [ ] `npm run build:apps-script` 후 생성된 `Code.gs`와 `appsscript.json`을 승인 계정의 project에 반영했다.
- [ ] Web App 새 version의 실행 주체가 `Me`, 접근자가 `Anyone`이다.
- [ ] 배포 URL은 저장소 밖에서만 전달했다.
- [ ] 로컬 검증은 `.env.local`의 `NEXT_PUBLIC_QUICK_ESTIMATE_APPS_SCRIPT_URL`로 주입했다.
- [ ] GitHub Actions secret `QUICK_ESTIMATE_APPS_SCRIPT_URL`에 같은 URL을 등록했다.
- [ ] Sheet 공유가 제한됨이고 소유 계정 외 접근자가 없다.
- [ ] `leads` 24개 header와 `codebook`, `lead_status` validation이 유지된다.
- [ ] 아래 실제 저장 E2E와 Sheet 대조가 끝났다.

`NEXT_PUBLIC_` 값은 정적 JavaScript에 포함되므로 인증 비밀이 아니다. 다만 배포 URL을 저장소 이력과 PR에 남기지 않기 위해 로컬 env와 GitHub secret으로만 전달한다. `main` 배포 job은 URL이 없거나 Apps Script Web App 형식이 아니면 빌드를 시작하지 않는다.

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
npm run build
npx playwright test e2e/quick-estimate-live.spec.ts
```

검증 항목:

1. 데스크톱 마케팅 미동의 제출이 `ok: true`로 끝난다.
2. 모바일 마케팅 동의 제출이 `ok: true`로 끝난다.
3. keyboard focus, 200% 확대, reduced motion, dialog axe 검사가 통과한다.
4. Sheet에서 두 행의 회사명·연락처·업종·직원 수·표시금액·난수·동의 version을 화면과 대조한다.
5. `marketing_agreed`, `marketing_channels`, `marketing_accepted_at`이 동의 여부에 맞는다.
6. Apps Script 실행 기록에 개인정보 원문이 없다.

테스트 행도 개인정보 처리 절차 밖에서 임의 삭제하지 않는다. 담당자가 대상 `lead_id`, 파기 사유와 승인자를 확인한 뒤 파기대장에 개인정보 없이 기록한다.

## 영업일 점검

1. Apps Script dashboard의 최근 실행에서 `Failed`와 비정상적으로 긴 `Running`을 확인한다.
2. 실패 로그의 공개 코드, 발생 시각, 검증된 `request_id`만 확인한다.
3. `leads`의 신규 행과 마지막 정상 접수 시각을 확인한다.
4. `RATE_LIMITED`가 반복되면 분·일·연락처 제한 중 어떤 구간인지 코드와 실행 시각으로 재현한다. 연락처 원문을 로그에 추가하지 않는다.
5. `STORAGE_UNAVAILABLE`, quota 예외 또는 신규 행 단절이 있으면 아래 장애 절차를 시작한다.

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
- 담당자는 원본 22개 제출 컬럼을 수정하지 않고 `lead_status`, `handled_at`만 운영한다.
- 월 1회 `submitted_at` 기준 1년 만료와 조기 파기 요청을 확인한다.
- 파기 사유 확인 후 최대 5영업일 안에 처리한다.
- 파기대장에는 `lead_id`, 파기일, 파기 사유만 기록한다.
- Sheets version history 때문에 행 삭제만으로 복구 불가능한 파기를 단정하지 않는다. 실제 영구 파기는 대상 분리, 새 파일 교체, 기존 파일 영구 삭제 절차를 별도 승인 후 수행한다.
- 소유 계정 복구 수단이나 접근자가 바뀌면 공개 접수를 먼저 중단하고 권한 기준을 다시 승인한다.

저장소에는 사람용 `상담 목록` 생성과 원본 투영 코드가 포함되어 있다. 운영 Sheet 반영, 상담 처리 상태 자동화와 접근 계정 승인이 끝나기 전에는 상담 담당자에게 이관수 계정 자격 증명을 공유하거나 기존 `leads`를 임의로 재구성하지 않는다. 이후에도 원본 24개 컬럼은 수정하지 않고 상담 담당자는 한글 업무 화면에서만 허용된 운영값을 변경한다.

## 변경과 rollback 기록

- Apps Script 배포 version, 프런트엔드 commit SHA, benchmark version을 한 release 기록에 묶는다.
- Sheet schema 변경은 기존 header 직접 편집이 아니라 별도 migration 계약으로 처리한다.
- 계산 규칙 rollback은 기존 행의 `estimate_rule_version`, `benchmark_version`을 보존한다.
- 운영 URL, Script ID, Sheet ID와 개인정보는 release 기록에 포함하지 않는다.
