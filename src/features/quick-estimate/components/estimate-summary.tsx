import styles from "./quick-estimate-dialog.module.css";
import type { QuickEstimateSummaryValues } from "../types/quick-estimate-ui";

/** 조회와 신청 화면에 동일한 확정 조건과 참고용 금액을 표시합니다. */
export function QuickEstimateSummary({
  amount,
  employeeCount,
  industryLabel,
}: QuickEstimateSummaryValues) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="font-bold text-[#666]">업종</dt>
        <dd className="min-w-0 text-[#212121]">{industryLabel}</dd>
        <dt className="font-bold text-[#666]">직원 수</dt>
        <dd>{employeeCount.toLocaleString("ko-KR")}명</dd>
      </dl>
      <div className={styles.resultCard}>
        <p className="text-sm text-[#666]">예상 환급액</p>
        <p className="text-[28px] text-[#2166ed]">{amount.toLocaleString("ko-KR")}원</p>
      </div>
      <p className="text-xs leading-normal text-[#666]">
        ※ 본 결과는 참고용 예상값이며, 실제 환급액과 다를 수 있습니다. 정확한 금액은 전문가와
        상담하세요.
      </p>
    </div>
  );
}
