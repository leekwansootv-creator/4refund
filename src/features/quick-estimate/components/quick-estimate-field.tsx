import type { InputHTMLAttributes } from "react";

import styles from "./quick-estimate-dialog.module.css";

type QuickEstimateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  error?: string | undefined;
  suffix?: string;
  initialFocus?: boolean;
};

/**
 * 간단 견적 연락처와 직원 수 입력에 동일한 label·오류 연결을 제공합니다.
 */
export function QuickEstimateField({
  id,
  label,
  error,
  suffix,
  initialFocus = false,
  ...inputProps
}: QuickEstimateFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className="text-[15px] leading-normal font-bold text-[#333]">
        {label}
      </label>
      <div className={`${styles.control} ${error ? styles.controlInvalid : ""}`}>
        <input
          {...inputProps}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={styles.input}
          data-dialog-initial-focus={initialFocus ? "" : undefined}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>
      {error ? (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
