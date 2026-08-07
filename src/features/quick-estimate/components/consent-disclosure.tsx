"use client";

import Image from "next/image";
import { useId, useState } from "react";

import styles from "./quick-estimate-dialog.module.css";
import { QUICK_ESTIMATE_ASSETS } from "../constants/quick-estimate-assets";

type ConsentDisclosureProps = {
  checked: boolean;
  label: string;
  required: boolean;
  children: string;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * 필수 여부가 분리된 native 동의 checkbox와 약관 전문 disclosure를 제공합니다.
 */
export function ConsentDisclosure({
  checked,
  label,
  required,
  children,
  onCheckedChange,
}: ConsentDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const checkboxId = useId();
  const detailsId = useId();

  return (
    <div className={styles.consent}>
      <div className={styles.consentRow}>
        <span className={styles.checkboxWrapper}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            required={required}
            className={styles.checkbox}
            onChange={(event) => onCheckedChange(event.currentTarget.checked)}
          />
          <Image
            src={QUICK_ESTIMATE_ASSETS.icons.check}
            alt=""
            width={12}
            height={9}
            className={styles.checkIcon}
          />
        </span>
        <label htmlFor={checkboxId} className={styles.consentLabel}>
          {label} ({required ? "필수" : "선택"})
        </label>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          className={styles.disclosureButton}
          onClick={() => setExpanded((current) => !current)}
        >
          [{expanded ? "접기" : "보기"}]
        </button>
      </div>
      {expanded ? (
        <div id={detailsId} className={styles.consentDetails}>
          {children
            .split("\n")
            .map((line, index) =>
              line ? <p key={`${index}-${line}`}>{line}</p> : <br key={`blank-${index}`} />,
            )}
        </div>
      ) : null}
    </div>
  );
}
