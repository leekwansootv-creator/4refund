# 간단 견적 Google Sheets 저장 웹 앱

## 범위

이 integration은 정적 랜딩과 분리된 Google Apps Script 실행 경계다. form encoded `payload`를 검증하고 기존 간단 견적 규칙으로 금액을 재계산한 뒤, 승인된 24개 컬럼의 `leads` Sheet에 한 행을 저장한다.

포함 범위는 다음과 같다.

- `request_id` 중복 방지와 Script lock
- 개인정보 필수 동의와 선택 마케팅 동의 version 검증
- spreadsheet formula injection 방어
- 서버 기준 UTC ISO 시각과 초기 상태 `NEW`
- 개인정보 원문을 제외한 실패 로그
- honeypot·제출 소요 시간 재검증
- 분·일·연락처 해시 기반 제출 제한과 `RATE_LIMITED` 응답

React 화면과 브라우저 transport는 `src/features/quick-estimate`가 소유한다. 계정·배포·실저장 E2E와 장애 대응은 [운영 runbook](../../../docs/operations/quick-estimate-runbook.md)을 따른다.

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
5. 함수 목록에서 `setupQuickEstimateStorage`를 선택해 한 번 실행하고 Sheet 권한을 승인한다.
6. 반환값의 `created`가 `true`인지 확인하고, 반환된 URL로 Sheet를 연다. 반환된 ID와 URL은 저장소나 PR에 남기지 않는다.
7. Sheet가 `leads`, `codebook` 두 탭을 가지는지 확인한다.
8. `leads` 첫 행이 24개 고정 header인지, 23번째 `lead_status` 열에 네 상태의 validation이 설정됐는지 확인한다.

같은 project에서 설정 함수를 다시 실행하면 Script Property에 보관된 기존 Sheet를 반환하며 새 Sheet를 만들지 않는다.

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

## 운영 계약

- 예상 제출량: 일 100건, 분당 10건
- 허용 상태: `NEW`, `CONTACTING`, `COMPLETED`, `CLOSED`
- 원본 제출 컬럼: 담당자 수정 금지
- 담당자 수정 컬럼: `lead_status`, `handled_at`
- 개인정보 보유: 접수일로부터 1년, 철회 또는 목적 달성 시 조기 파기
- 파기 대상 확인: 월 1회
- 파기 사유 확인 후 내부 처리 상한: 영업일 5일
- 마케팅 철회 상태 반영 상한: 영업일 3일
- 파기 로그: 개인정보 없이 `lead_id`, 파기일, 파기 사유만 별도 기록
- 자동 제출 방지: 빈 honeypot, 제출까지 3초 이상·2시간 이하
- 제출 제한: 전체 10건/분·100건/일, 같은 이메일+전화 해시 3건/시간
- 점검: 영업일마다 1회, 장애 대응 담당자 이관수, 인지 후 1영업일 안에 대응 시작

Google Sheets의 행 삭제는 version history에서 복구될 수 있으므로 영구 파기로 단정하지 않는다. 공개 전 승인 계정에서 보유 대상 분리, 새 파일 교체와 기존 파일 영구 삭제 절차를 실제로 검증해야 한다. 이 검증이 끝나기 전에는 운영 공개 승인을 완료한 것으로 처리하지 않는다.

## 장애와 롤백

- 저장 실패는 `STORAGE_UNAVAILABLE`로 축약하며 입력 원문이나 내부 stack을 응답하지 않는다.
- 실패 로그에는 오류 코드, 실행 시각, 검증된 요청의 `request_id`만 기록한다.
- Apps Script 배포를 중지하면 신규 제출만 차단된다.
- 코드 롤백은 기존 Sheet 행을 수정하거나 삭제하지 않는다.
- Sheet schema를 바꿔야 하면 기존 header를 즉시 수정하지 않고 별도 migration·호환 계약을 먼저 승인한다.
