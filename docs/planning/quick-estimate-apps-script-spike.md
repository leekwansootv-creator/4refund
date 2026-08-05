# 간단 견적 Apps Script 전송 방식 검증

## 문서 목적

이 문서는 정적 4refund 사이트에서 Google Apps Script Web App으로 상담 데이터를 전송할 수 있는지 2026-08-05에 수행한 기술 검증 결과를 기록한다. 검증 범위는 교차 출처 `POST`, redirect, 응답 body 판독, 저장·검증·서버 실패 구분, timeout과 재시도, 테스트 배포 권한 회수다.

Apps Script 프로젝트, Google Sheet, 배포 URL과 식별자는 저장소 밖의 인가된 이관수 Google 계정이 소유한다. 이 문서에는 재사용 가능한 비밀값이나 정확한 계정 이메일, Script ID, Sheet ID, 배포 URL을 기록하지 않는다.

## 관련 문서

- [간단 견적 리드 수집 기능 기획](quick-estimate-lead-collection.md)
- [간단 견적 리드 수집 기술 설계](quick-estimate-technical-design.md)
- [간단 견적 기능 PR 로드맵](quick-estimate-pr-roadmap.md)
- [품질 게이트](../engineering/quality-gates.md)

## 판정

Google Apps Script Web App을 간단 견적의 서버리스 제출 중계 후보로 **채택**한다.

채택 범위는 `application/x-www-form-urlencoded;charset=UTF-8` 단순 요청과 JSON 응답 계약이다. `application/json` 요청은 브라우저 preflight가 `405`로 실패하므로 채택하지 않는다. `no-cors`와 응답을 읽지 않는 form navigation도 저장 성공을 증명할 수 없어 사용하지 않는다.

이 판정은 운영 구현 완료를 뜻하지 않는다. Apps Script 검증·저장 로직, 스팸 방지, 운영 Sheet schema와 브라우저 transport는 각각 후속 PR에서 구현하고 다시 검증한다. 디자인이 확정되기 전까지 랜딩 UI와 공개 진입점은 만들지 않는다.

## 검증 환경

| 항목                  | 값                                                  |
| --------------------- | --------------------------------------------------- |
| 검증일                | 2026-08-05                                          |
| 운영 정적 origin      | `https://www.4refund.kr`                            |
| 브라우저 검증 origin  | 일회성 로컬 정적 HTTP origin                        |
| 실행 브라우저         | 인가 계정으로 로그인된 Chrome                       |
| Apps Script 실행 주체 | 인가된 이관수 Google 계정                           |
| Web App 접근 권한     | 검증 중 `모든 사용자`, 검증 후 배포 보관처리        |
| 저장소                | 운영과 분리한 비공개 테스트 Google Sheet            |
| 데이터                | `.test` 이메일과 가짜 회사명·담당자·전화번호만 사용 |

운영 origin은 실제 값을 `Origin` 헤더로 보낸 HTTP 응답에서 확인했다. 브라우저 body 판독은 동일한 교차 출처 조건의 로컬 정적 페이지에서 실행했다. 최초 redirect와 최종 응답이 모두 `Access-Control-Allow-Origin: *`를 반환하므로 origin별 허용 목록 차이는 없다고 판단한다. 운영 페이지에 검증 코드를 임시 배포하지 않았으므로 최종 공개 PR에서는 운영 origin E2E를 다시 실행한다.

## 검증용 요청 계약

브라우저는 `URLSearchParams`로 body를 만들고 쿠키나 Google 자격 증명 없이 전송한다. 운영의 중첩 요청 schema는 하나의 `payload` form field에 JSON 문자열로 담고 Apps Script가 `e.parameter.payload`를 parse한다.

```ts
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
  },
  body: new URLSearchParams({
    payload: JSON.stringify(payload),
  }),
  redirect: "follow",
  signal,
});

const result = await response.json();
```

spike fixture는 전송 관측에 필요한 flat form field만 사용했다. 중첩 운영 payload의 parse와 전체 schema 검증은 후속 저장 구현에서 같은 content type으로 다시 검증한다.

Apps Script `ContentService` 응답은 도메인 결과와 관계없이 HTTP `200`으로 반환될 수 있다. 따라서 `response.ok`만으로 성공 처리하지 않고 JSON의 `ok`와 결과 코드를 함께 확인한다. 아래 `outcome`은 spike 분기를 관측하기 위한 임시 필드이며 운영 응답 schema는 [기술 설계의 성공·실패 응답](quick-estimate-technical-design.md#성공-응답)을 따른다.

| 결과                                      | body 판정                                         | 클라이언트 상태 |
| ----------------------------------------- | ------------------------------------------------- | --------------- |
| Sheet 저장 완료                           | `ok: true`, `outcome: "persisted"`                | 접수 완료       |
| 입력·동의 검증 거절                       | `ok: false`, `outcome: "validation_error"`        | 입력 오류       |
| 저장·서버 처리 실패                       | `ok: false`, `outcome: "storage_or_server_error"` | 접수 실패       |
| `AbortError`, `TypeError`, JSON 판독 실패 | 신뢰 가능한 body 없음                             | 저장 여부 불명  |

## 실행 결과

| 시나리오                 | 관측 결과                                                  | 판정                                  |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------- |
| 비공개 배포 접근         | 로그인 없는 `POST`가 `401`                                 | 공개 호출에는 `모든 사용자` 권한 필요 |
| form encoded 최초 응답   | `302`, Location 존재, CORS `*`                             | redirect 발생                         |
| redirect follow          | 최종 `200`, `script.googleusercontent.com`, JSON, CORS `*` | 브라우저 body 판독 가능               |
| 정상 저장                | `persisted`, `duplicate: false`                            | 저장 완료 구분 가능                   |
| 필수값·동의·사원 수 오류 | `validation_error`와 필드별 코드                           | 검증 실패 구분 가능                   |
| 강제 저장 실패           | `storage_or_server_error`, 공개 오류 코드                  | 서버 실패 구분 가능                   |
| 동일 `requestId` 재시도  | 첫 요청 `duplicate: false`, 재시도 `duplicate: true`       | 한 행만 추가하는 계약 확인            |
| `application/json`       | OPTIONS preflight `405`, 브라우저 `TypeError`              | 사용 금지                             |
| 요청 중단                | 브라우저 `AbortError`                                      | 성공 처리 금지, 저장 여부 불명        |
| 배포 보관처리 후         | 외부 `POST` `404`                                          | 공개 호출 권한 회수 확인              |

성공·검증 실패·서버 실패는 모두 redirect 이후 JSON body로 구분됐다. 실패도 HTTP `200`일 수 있으므로 body 판정이 누락되면 실패를 성공으로 오인할 수 있다.

## 재시도와 멱등성

timeout이나 네트워크 단절은 브라우저가 서버 저장 여부를 확정할 수 없는 상태다. 이 상태를 접수 완료로 표시하지 않으며 새 식별자로 자동 재제출하지 않는다.

재시도가 필요하면 최초 요청의 `requestId`를 그대로 사용한다. 검증용 Apps Script에서는 script lock 안에서 기존 `requestId`를 확인한 뒤 새 행을 추가했고, 동일 식별자의 두 번째 요청에는 기존 저장 성공을 나타내는 `duplicate: true`를 반환했다.

후속 저장 구현은 다음 순서를 유지해야 한다.

1. 외부 입력과 동의 계약을 검증한다.
2. script lock을 획득한다.
3. 동일 `requestId`의 기존 저장 여부를 확인한다.
4. 기존 행이면 새 행을 만들지 않고 동일 성공 계약을 반환한다.
5. 신규 요청만 한 행을 저장하고 flush 완료 후 성공을 반환한다.
6. lock timeout, quota, Sheet 오류는 저장 성공과 다른 body로 반환한다.

## 보안·운영 제약

- 배포 URL은 인증 비밀값이 아니라 공개 설정으로 취급한다.
- Google 계정 자격 증명, Script ID와 Sheet ID는 브라우저 bundle과 저장소에 넣지 않는다.
- Web App은 소유자 권한으로 실행하므로 모든 브라우저 입력을 불신하고 다시 검증한다.
- 공개 endpoint에는 스팸, 자동 제출과 Apps Script quota 소진 위험이 있다.
- 운영 구현 전 rate limit 또는 CAPTCHA 정책, Sheet 접근자, 장애 점검 주기와 파기 절차를 확정한다.
- 회사명·담당자 이름 등 Sheet 문자열의 formula injection 방어는 후속 저장 구현에서 적용한다.
- CORS와 redirect는 외부 플랫폼 동작이므로 배포 version 변경과 최종 공개 전에 회귀 검증한다.

## 테스트 자산과 정리 상태

- 검증 중 만든 로컬 정적 HTML과 HTTP 서버는 결과 확인 후 제거·종료했다.
- 테스트 Web App 배포는 보관 처리했고 외부 `POST`가 `404`를 반환하는지 확인했다.
- 테스트 Apps Script 프로젝트와 비공개 Sheet는 인가된 이관수 Google 계정에 검증 증빙으로 남겼다.
- Sheet에는 가짜 데이터만 있으며 운영 리드 저장소로 사용하지 않는다.
- 후속 작업에서 재사용하려면 새 배포 version을 만들고 필요한 기간에만 공개 호출 권한을 부여한다.

## 후속 PR 계약

- PR 3은 Apps Script나 DOM에 의존하지 않는 견적 계산 엔진만 구현한다.
- PR 4는 form encoded `payload` field parse, [기술 설계의 응답 schema](quick-estimate-technical-design.md#성공-응답)와 동일 `requestId` 멱등성 계약을 운영 수준으로 구현한다.
- PR 5는 `AbortError`와 네트워크 오류를 저장 여부 불명 상태로 유지하고, JSON body를 확인한 경우에만 성공 상태로 전환한다.
- 최종 공개 PR은 `https://www.4refund.kr`에서 실제 배포 endpoint로 정상·검증 실패·저장 실패·재시도 E2E를 다시 수행한다.
