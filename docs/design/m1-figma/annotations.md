# 노드에 연결된 개발 주석 원문

MCP 원본에서 명시적 주석 속성과 컴포넌트 설명을 추출했다. 주변 TEXT 및 브라우저에서만 보인 주석은 [화면 명세](screen-spec.md)와 [수집 범위](coverage.md)를 함께 읽는다.

## 개발 주석

### 1. 내작업 : 목록로딩_스켈레톤

노드: [512:432](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=512-432) · 원본: [512-432.txt](evidence/mcp/512-432.txt)

모든 목록 로딩은 스켈레톤 애니메이션으로 재생합니다.

### 2. I518:2730;679:6806;679:6577

노드: [I518:2730;679:6806;679:6577](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=I518-2730;679-6806;679-6577) · 원본: [518-2729.txt](evidence/mcp/518-2729.txt)

클릭 시 이메일로 이동

### 3. Success Toast

노드: [531:17877](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=531-17877) · 원본: [531-17797.txt](evidence/mcp/531-17797.txt)

위로 32px의 여백, 중앙에서 즉시 나타납니다.

### 4. 급여대장

노드: [591:24500](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=591-24500) · 원본: [591-24462.txt](evidence/mcp/591-24462.txt)

파일첨부를 1개만 할 경우.

:라인을 구분하는 외곽선을 표시하지 않습니다.

파일첨부가 2개 이상 일 경우.

:마지막 파일에 외곽선을 표시하지 않습니다.

### 5. 새 작업 요청 : 요청 내용 확인 : 중복·재요청 경고

노드: [602:29127](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=602-29127) · 원본: [602-29127.txt](evidence/mcp/602-29127.txt)

R04 공통 분기 규칙

완료된 작업 이후 새 실행을 요청하는 경우에도 서버의 중복·최근 이력 검사를 적용합니다. 회사·기능·기간·자료가 변경되면 기존 확인 체크를 해제하고 다시 검사합니다. 최종 파기 대상 청구에는 새 실행을 연결할 수 없습니다. 경고에는 다른 사용자의 이름·금액·파일을 표시하지 않습니다.

중복·재요청 판단은 서버 기준으로 처리합니다.  
같은 회사·기능에서 대상 기간이 겹치고 기존 작업의 실제 실행 여부가 불명확한 경우, 직원·부서 범위의 비중첩이 확인되지 않으면 접수를 보류합니다. 서버가 비중첩을 확인한 요청은 허용하며, 파일을 변경해도 이 검사를 생략하지 않습니다.  
파일을 변경해도 중첩 검사를 생략하지 않습니다.  
서버가 비중첩으로 확인한 요청은 접수할 수 있습니다.  
본 경정청구는 CMS 접수일 기준 직전 3년의 같은 회사 작업 이력을 확인하여 경고합니다.

### 6. NewTaskBtn

노드: [717:8964](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=717-8964) · 원본: [709-6738.txt](evidence/mcp/709-6738.txt)

**현재 이 경정청구에 신고 담당자로 배정된 사용자에게만** 보이는 버튼

### 7. TaskTypeSelector

노드: [717:9064](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=717-9064) · 원본: [717-8980.txt](evidence/mcp/717-8980.txt)

1.  `환급 완료` 선택 → `환급 완료일` 표시, `종료 사유` 숨김
2.  `환급 없이 계약 종료` 선택 → `계약 종료일`과 `종료 사유` 표시

### 8. PrimaryActionBtn

노드: [740:6399](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=740-6399) · 원본: [740-6386.txt](evidence/mcp/740-6386.txt)

클릭 시 이메일로 이동

### 9. ActionBtn

노드: [740:6511](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=740-6511) · 원본: [740-6499.txt](evidence/mcp/740-6499.txt)

클릭 시 이메일로 이동

### 10. 영업직 목록

노드: [923:20090](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=923-20090) · 원본: [813-10065.txt](evidence/mcp/813-10065.txt)

아래 파일명·형식·개수는 예시이며, 실제 산출물은 역할·대상 연도와 검증 결과에 따라 달라집니다. 서버에서 확인된 완료 파일만 제공하며 미생성 시 확인된 사유를 표시합니다.

### 11. Data retention container

노드: [923:20108](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=923-20108) · 원본: [813-10065.txt](evidence/mcp/813-10065.txt)

서버 상태에 따라 이관 중·이관 지연·백업 보관 중·실행 종료 대기·파기 보류·파기 지연·자료 전체 파기 완료를 표시합니다. 실행 중인 RPA가 있으면 실제 실행 종료와 생성 파일 삭제가 확인될 때까지 `실행 종료 대기`로 표시합니다. 별도 전체 화면은 만들지 않습니다.

### 12. 작업상세 : 본 경정청구 준비 : 결과 검증 보류_결과탭

노드: [923:20145](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=923-20145) · 원본: [923-20145.txt](evidence/mcp/923-20145.txt)

결과 검증 보류로 전환되면 진행 중인 결과 파일 다운로드와 이어받기를 중단하고, 기존 화면 또는 클라이언트 캐시에 남아 있는 결과 금액·파일을 숨깁니다. 제출 자료의 서버 보관 상태와 결과 파일 제공 상태는 별도로 처리합니다.

### 13. Header cell

노드: [923:20482](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=923-20482) · 원본: [923-20333.txt](evidence/mcp/923-20333.txt)

후속 행동이 있는 경우 서버 응답에 따라 버튼을 표시

### 14. 새 신고 담당자 Content

노드: [923:20810](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=923-20810) · 원본: [923-20733.txt](evidence/mcp/923-20733.txt)

신고 담당자 해제 시 확인 절차를 거쳐 미배정 상태로 변경합니다. 자기 배정도 동일한 권한 검사를 적용합니다.

신고 담당자 변경·해제 후에도 관계별 접근 권한을 다시 확인합니다.

1.  이전 신고 담당자만 해당: 이전 배정에 따른 자료 접근과 신고 처리 권한 종료
2.  원래 영업 담당자이기도 함: 본인 의뢰 접근은 유지하고, 신고 검토·업무 종료 기록 권한만 종료
3.  관계 없는 총괄 관리자: 상태·금액 요약만 제공하고 원본 자료·인계 정보는 제공하지 않음
4.  총괄 관리자가 해당 의뢰의 영업 담당자 또는 현재 신고 담당자인 경우: 해당 관계에 따른 자료 접근 제공
5.  개발자: 운영 목적의 접근은 유지하되 자료 제공·보관·파기 제한 적용

## 컴포넌트 설명

### 1. Status=결과 수신 중

노드: [686:5961](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=686-5961) · 원본: [518-2729.txt](evidence/mcp/518-2729.txt), [649-6967.txt](evidence/mcp/649-6967.txt), [675-24297.txt](evidence/mcp/675-24297.txt), [675-24353.txt](evidence/mcp/675-24353.txt), [mcp-status-tag.txt](evidence/mcp-status-tag.txt)

결과를 서버에 저장·검증하고 있습니다. 실제 RPA 종료가 확인된 경우에만 처리 종료 문구 표시

### 2. Status=자료 파기로 종료

노드: [698:5766](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=698-5766) · 원본: [518-2729.txt](evidence/mcp/518-2729.txt), [649-6967.txt](evidence/mcp/649-6967.txt), [mcp-status-tag.txt](evidence/mcp-status-tag.txt)

입력 자료 또는 결과 자료가 최종 파기되어 정상 결과 없이 작업이 종결된 상태입니다. 완료·실패·전체 파기 완료와 구분합니다.

### 3. TaskTypeSelector

노드: [562:4378](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=562-4378) · 원본: [553-19867.txt](evidence/mcp/553-19867.txt), [562-4378.txt](evidence/mcp/562-4378.txt), [572-20511.txt](evidence/mcp/572-20511.txt), [577-4555.txt](evidence/mcp/577-4555.txt), [627-36118.txt](evidence/mcp/627-36118.txt), [649-6091.txt](evidence/mcp/649-6091.txt), [717-8980.txt](evidence/mcp/717-8980.txt), [923-20493.txt](evidence/mcp/923-20493.txt), [923-20627.txt](evidence/mcp/923-20627.txt)

두 작업 유형 중 하나만 선택하는 단일 선택 그룹입니다. Selection 속성으로 선택 상태를 전환합니다.

### 4. YearField

노드: [565:4688](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=565-4688) · 원본: [553-19867.txt](evidence/mcp/553-19867.txt), [565-4688.txt](evidence/mcp/565-4688.txt), [627-36118.txt](evidence/mcp/627-36118.txt)

연도 입력 필드입니다. State는 Empty, PickerOpen, Selected이며 Value 속성으로 선택 연도를 변경합니다.

### 5. MonthRangeField

노드: [558:4460](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=558-4460) · 원본: [558-4460.txt](evidence/mcp/558-4460.txt), [572-20511.txt](evidence/mcp/572-20511.txt), [577-4555.txt](evidence/mcp/577-4555.txt), [649-6091.txt](evidence/mcp/649-6091.txt)

시작 연월을 선택하면 종료 연월은 +3개월로 표시합니다. 예상 환급액 조회에는 선택한 3개월의 전체 직원 급여대장이 필요합니다.

### 6. YearCell

노드: [565:4511](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=565-4511) · 원본: [565-4511.txt](evidence/mcp/565-4511.txt), [565-4573.txt](evidence/mcp/565-4573.txt), [565-4688.txt](evidence/mcp/565-4688.txt)

YearPicker에서 사용하는 연도 셀입니다. State로 기본/선택 상태를 전환합니다.

### 7. YearPicker

노드: [565:4573](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=565-4573) · 원본: [565-4573.txt](evidence/mcp/565-4573.txt), [565-4688.txt](evidence/mcp/565-4688.txt)

12개 연도 범위를 탐색하고 하나의 연도를 선택하는 Picker입니다.

### 8. State=Default

노드: [577:4712](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=577-4712) · 원본: [572-20511.txt](evidence/mcp/572-20511.txt), [576-21777.txt](evidence/mcp/576-21777.txt), [578-1762.txt](evidence/mcp/578-1762.txt), [591-23969.txt](evidence/mcp/591-23969.txt), [602-27321.txt](evidence/mcp/602-27321.txt), [717-17810.txt](evidence/mcp/717-17810.txt), [717-18563.txt](evidence/mcp/717-18563.txt), [730-13772.txt](evidence/mcp/730-13772.txt), [740-6516.txt](evidence/mcp/740-6516.txt), [771-12585.txt](evidence/mcp/771-12585.txt), [789-14824.txt](evidence/mcp/789-14824.txt), [789-15205.txt](evidence/mcp/789-15205.txt), [796-8402.txt](evidence/mcp/796-8402.txt)

한 줄 텍스트 입력 필드입니다. Value 속성으로 플레이스홀더 또는 입력값을 변경합니다.

### 9. InputField

노드: [578:1762](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=578-1762) · 원본: [572-20511.txt](evidence/mcp/572-20511.txt), [576-21777.txt](evidence/mcp/576-21777.txt), [578-1762.txt](evidence/mcp/578-1762.txt), [591-23969.txt](evidence/mcp/591-23969.txt), [602-27321.txt](evidence/mcp/602-27321.txt), [717-17810.txt](evidence/mcp/717-17810.txt), [717-18563.txt](evidence/mcp/717-18563.txt), [730-13772.txt](evidence/mcp/730-13772.txt), [740-6516.txt](evidence/mcp/740-6516.txt), [771-12585.txt](evidence/mcp/771-12585.txt), [771-8040.txt](evidence/mcp/771-8040.txt), [789-14824.txt](evidence/mcp/789-14824.txt), [789-15205.txt](evidence/mcp/789-15205.txt), [796-8402.txt](evidence/mcp/796-8402.txt)

재사용 가능한 한 줄 인풋입니다. Default, Hover, Focus, Filled, Error, Disabled 상태와 Value 속성을 지원합니다.

### 10. FileUploadRow

노드: [583:2170](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=583-2170) · 원본: [576-20968.txt](evidence/mcp/576-20968.txt), [576-21282.txt](evidence/mcp/576-21282.txt), [583-2170.txt](evidence/mcp/583-2170.txt), [591-23969.txt](evidence/mcp/591-23969.txt), [591-24462.txt](evidence/mcp/591-24462.txt), [602-26918.txt](evidence/mcp/602-26918.txt), [602-27321.txt](evidence/mcp/602-27321.txt), [877-9121.txt](evidence/mcp/877-9121.txt)

파일 1개 단위 전송 상태. 접수 상태 및 RPA 작업 상태와 분리한다. 전송 중에만 파일별 전송량·진행률을 표시한다.

### 11. StatusBadge

노드: [583:5005](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=583-5005) · 원본: [576-20968.txt](evidence/mcp/576-20968.txt), [576-21282.txt](evidence/mcp/576-21282.txt), [576-21674.txt](evidence/mcp/576-21674.txt), [576-21777.txt](evidence/mcp/576-21777.txt), [577-4496.txt](evidence/mcp/577-4496.txt), [583-2170.txt](evidence/mcp/583-2170.txt), [583-5005.txt](evidence/mcp/583-5005.txt), [591-23969.txt](evidence/mcp/591-23969.txt), [591-24462.txt](evidence/mcp/591-24462.txt), [591-25588.txt](evidence/mcp/591-25588.txt), [591-25823.txt](evidence/mcp/591-25823.txt), [602-26051.txt](evidence/mcp/602-26051.txt), [602-26918.txt](evidence/mcp/602-26918.txt), [602-27321.txt](evidence/mcp/602-27321.txt), [832-12130.txt](evidence/mcp/832-12130.txt), [855-17582.txt](evidence/mcp/855-17582.txt), [877-9121.txt](evidence/mcp/877-9121.txt)

선택됨, 업로드 실패, 미첨부 상태를 표시하는 배지 컴포넌트입니다.

### 12. Status=Failed

노드: [583:2169](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=583-2169) · 원본: [576-21282.txt](evidence/mcp/576-21282.txt), [583-2170.txt](evidence/mcp/583-2170.txt), [602-26918.txt](evidence/mcp/602-26918.txt)

개별 파일 전송 실패. 다시 시도 또는 같은 파일 재선택 안내에 사용한다.

### 13. RetryActionBtn

노드: [582:1903](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=582-1903) · 원본: [576-21282.txt](evidence/mcp/576-21282.txt), [582-1903.txt](evidence/mcp/582-1903.txt), [583-2170.txt](evidence/mcp/583-2170.txt), [602-26918.txt](evidence/mcp/602-26918.txt)

다시 선택 및 위험/재시도 액션에 사용하는 #E53E3E 컬러 버튼입니다.

### 14. State=Hover

노드: [578:1752](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=578-1752) · 원본: [578-1762.txt](evidence/mcp/578-1762.txt)

한 줄 텍스트 입력 필드입니다. Value 속성으로 플레이스홀더 또는 입력값을 변경합니다.

### 15. State=Focus

노드: [578:1754](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=578-1754) · 원본: [578-1762.txt](evidence/mcp/578-1762.txt)

한 줄 텍스트 입력 필드입니다. Value 속성으로 플레이스홀더 또는 입력값을 변경합니다.

### 16. State=Filled

노드: [578:1756](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=578-1756) · 원본: [578-1762.txt](evidence/mcp/578-1762.txt), [771-8040.txt](evidence/mcp/771-8040.txt)

한 줄 텍스트 입력 필드입니다. Value 속성으로 플레이스홀더 또는 입력값을 변경합니다.

### 17. State=Error

노드: [578:1758](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=578-1758) · 원본: [578-1762.txt](evidence/mcp/578-1762.txt), [796-8402.txt](evidence/mcp/796-8402.txt)

한 줄 텍스트 입력 필드입니다. Value 속성으로 플레이스홀더 또는 입력값을 변경합니다.

### 18. State=Disabled

노드: [578:1760](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=578-1760) · 원본: [578-1762.txt](evidence/mcp/578-1762.txt)

한 줄 텍스트 입력 필드입니다. Value 속성으로 플레이스홀더 또는 입력값을 변경합니다.

### 19. 상태=파일제출

노드: [591:24922](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=591-24922) · 원본: [591-23969.txt](evidence/mcp/591-23969.txt), [591-24462.txt](evidence/mcp/591-24462.txt), [602-26918.txt](evidence/mcp/602-26918.txt), [602-27321.txt](evidence/mcp/602-27321.txt), [877-9121.txt](evidence/mcp/877-9121.txt)

파일 전송 상태는 제목이 아니라 각 파일 행에 표시한다.

### 20. 상태=추가입력+파일제출

노드: [602:27718](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=602-27718) · 원본: [591-23969.txt](evidence/mcp/591-23969.txt), [602-27321.txt](evidence/mcp/602-27321.txt)

파일 전송 상태는 제목이 아니라 각 파일 행에 표시한다.

### 21. DayField

노드: [722:14435](https://www.figma.com/design/ijPZL5WxrjvxbHjBp0DoQa/?node-id=722-14435) · 원본: [717-8980.txt](evidence/mcp/717-8980.txt), [722-14435.txt](evidence/mcp/722-14435.txt), [923-20493.txt](evidence/mcp/923-20493.txt), [923-20627.txt](evidence/mcp/923-20627.txt)

연도 입력 필드입니다. State는 Empty, PickerOpen, Selected이며 Value 속성으로 선택 연도를 변경합니다.
